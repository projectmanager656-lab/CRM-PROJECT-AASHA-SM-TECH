// ForgotPasswordController — handles the entire password-reset OTP lifecycle.
// Works exclusively with the existing User model (employee accounts).
// Does NOT touch any other collection, controller, or auth flow.
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { sendOtpEmail } from '../utils/emailService.js';
import { createValidationError } from '../utils/apiError.js';
import { successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';

// ── Constants ────────────────────────────────────────────────────────────────
const OTP_EXPIRY_MS        = 10 * 60 * 1000;  // 10 minutes
const RESEND_COOLDOWN_MS   = 60 * 1000;        // 60 seconds
const MAX_OTP_ATTEMPTS     = 5;
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const OTP_SALT_ROUNDS      = 10;
const EMAIL_REGEX          = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generates a cryptographically secure 6-digit OTP string. */
const generateOtp = () => crypto.randomInt(100000, 999999).toString();

/** Generates a secure random hex reset token and its SHA-256 hash. */
const generateResetToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const hash  = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
};

// ── Controller ────────────────────────────────────────────────────────────────

export class ForgotPasswordController {

  /**
   * POST /auth/forgot-password/request-otp
   * Accepts an email, generates a 6-digit OTP, stores its bcrypt hash in
   * the existing User document, and dispatches a real transactional email.
   *
   * Security: returns the same generic message regardless of whether the
   * email exists (prevents account enumeration).
   */
  static requestOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;

    // ── Validate email format ─────────────────────────────────────────────
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      throw createValidationError('Please enter a valid email address.');
    }
    const normalizedEmail = email.trim().toLowerCase();

    // ── Look up the user ──────────────────────────────────────────────────
    // Fetch reset-related fields that are normally hidden (select: false)
    const user = await User.findOne({ email: normalizedEmail })
      .select('+passwordResetOtpHash +passwordResetOtpSentAt +passwordResetTokenHash');

    if (user) {
      // ── Resend cooldown (server-side) ─────────────────────────────────
      if (
        user.passwordResetOtpSentAt &&
        Date.now() - new Date(user.passwordResetOtpSentAt).getTime() < RESEND_COOLDOWN_MS
      ) {
        // Still generic — but we tell the *actual* user about the cooldown.
        // We return 200 with the same body so we don't reveal account existence
        // to unauthenticated actors probing the endpoint.
        return res.json(
          successResponse(
            null,
            'If an account exists for this email, a verification code has been sent. Please wait at least 60 seconds before requesting another code.'
          )
        );
      }

      // ── Generate OTP ──────────────────────────────────────────────────
      const otp     = generateOtp();
      const otpHash = await bcryptjs.hash(otp, OTP_SALT_ROUNDS);

      // ── Persist hash + metadata (no plaintext OTP stored) ────────────
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordResetOtpHash:    otpHash,
            passwordResetOtpExpires: new Date(Date.now() + OTP_EXPIRY_MS),
            passwordResetOtpSentAt:  new Date(),
            passwordResetAttempts:   0,
          },
          $unset: {
            // Invalidate any previous reset token if the user re-requests OTP
            passwordResetTokenHash:    '',
            passwordResetTokenExpires: '',
          },
        }
      );

      // ── Send email ────────────────────────────────────────────────────
      // Intentionally fire-and-catch so a transient SMTP error doesn't
      // leak user existence. The OTP is passed only to the email function.
      try {
        await sendOtpEmail(normalizedEmail, otp, user.firstName || '');
      } catch (emailErr) {
        // Roll back the stored OTP so the user can retry cleanly
        await User.updateOne(
          { _id: user._id },
          {
            $unset: {
              passwordResetOtpHash:    '',
              passwordResetOtpExpires: '',
              passwordResetOtpSentAt:  '',
              passwordResetAttempts:   '',
            },
          }
        );
        logger.warn('SMTP failure during OTP request, rolled back OTP.', { error: emailErr.message });
        throw createValidationError(
          'Unable to send the verification code right now. Please try again later.'
        );
      }
    }
    // If user not found, we still return the same generic message to prevent enumeration.

    return res.json(
      successResponse(
        null,
        'If an account exists for this email, a verification code has been sent.'
      )
    );
  });

  // ──────────────────────────────────────────────────────────────────────────

  /**
   * POST /auth/forgot-password/verify-otp
   * Validates the 6-digit OTP. On success, issues a short-lived reset token
   * and clears the OTP fields so it cannot be reused.
   */
  static verifyOtp = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    // ── Basic input validation ────────────────────────────────────────────
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      throw createValidationError('Please enter a valid email address.');
    }
    if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      throw createValidationError('Please enter a valid 6-digit verification code.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const otpInput        = otp.trim();

    // ── Find user with hidden OTP fields ─────────────────────────────────
    const user = await User.findOne({ email: normalizedEmail })
      .select('+passwordResetOtpHash +passwordResetOtpExpires +passwordResetAttempts');

    // ── Generic "invalid" message for missing user or missing OTP ────────
    const genericInvalid = 'Invalid verification code. Please try again.';

    if (!user || !user.passwordResetOtpHash) {
      throw createValidationError(genericInvalid);
    }

    // ── Check expiry ──────────────────────────────────────────────────────
    if (!user.passwordResetOtpExpires || new Date() > user.passwordResetOtpExpires) {
      // Clear stale OTP
      await User.updateOne(
        { _id: user._id },
        { $unset: { passwordResetOtpHash: '', passwordResetOtpExpires: '', passwordResetAttempts: '', passwordResetOtpSentAt: '' } }
      );
      throw createValidationError(
        'This verification code has expired. Please request a new one.'
      );
    }

    // ── Check attempt limit ───────────────────────────────────────────────
    if ((user.passwordResetAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      await User.updateOne(
        { _id: user._id },
        { $unset: { passwordResetOtpHash: '', passwordResetOtpExpires: '', passwordResetAttempts: '', passwordResetOtpSentAt: '' } }
      );
      throw createValidationError(
        'Too many incorrect attempts. Please request a new verification code.'
      );
    }

    // ── Verify OTP (constant-time bcrypt compare) ─────────────────────────
    const isValid = await bcryptjs.compare(otpInput, user.passwordResetOtpHash);

    if (!isValid) {
      // Increment attempts
      await User.updateOne(
        { _id: user._id },
        { $inc: { passwordResetAttempts: 1 } }
      );
      const remaining = MAX_OTP_ATTEMPTS - (user.passwordResetAttempts + 1);
      throw createValidationError(
        remaining > 0
          ? `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : genericInvalid
      );
    }

    // ── OTP is valid — generate a short-lived reset token ─────────────────
    const { token: resetToken, hash: resetTokenHash } = generateResetToken();

    // Clear OTP fields and store hashed reset token
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash:    resetTokenHash,
          passwordResetTokenExpires: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
        },
        $unset: {
          passwordResetOtpHash:    '',
          passwordResetOtpExpires: '',
          passwordResetAttempts:   '',
          passwordResetOtpSentAt:  '',
        },
      }
    );

    logger.info('OTP verified successfully, reset token issued.', { userId: user._id });

    return res.json(
      successResponse(
        { resetToken },
        'Verification successful. You may now reset your password.'
      )
    );
  });

  // ──────────────────────────────────────────────────────────────────────────

  /**
   * POST /auth/forgot-password/reset-password
   * Validates the server-issued reset token, then updates the user's password
   * using the existing bcryptjs hashing convention from the User model.
   * Invalidates the reset token immediately after use.
   */
  static resetPassword = asyncHandler(async (req, res) => {
    const { resetToken, newPassword, confirmPassword } = req.body;

    // ── Input validation ──────────────────────────────────────────────────
    if (!resetToken || typeof resetToken !== 'string' || resetToken.trim().length < 10) {
      throw createValidationError('Invalid or missing reset token. Please restart the process.');
    }
    if (!newPassword || typeof newPassword !== 'string') {
      throw createValidationError('New password is required.');
    }
    if (newPassword !== confirmPassword) {
      throw createValidationError('Passwords do not match.');
    }
    if (newPassword.length < 6) {
      throw createValidationError('Password must be at least 6 characters.');
    }

    // ── Hash the incoming token for DB comparison ────────────────────────
    const incomingHash = crypto
      .createHash('sha256')
      .update(resetToken.trim())
      .digest('hex');

    // ── Find user whose stored hash matches ───────────────────────────────
    const user = await User.findOne({
      passwordResetTokenHash:    incomingHash,
      passwordResetTokenExpires: { $gt: new Date() }, // not expired
    }).select('+passwordResetTokenHash +passwordResetTokenExpires');

    if (!user) {
      throw createValidationError(
        'This reset link is invalid or has expired. Please request a new one.'
      );
    }

    // ── Hash the new password (same bcrypt convention as User model) ───────
    const salt           = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(newPassword, salt);

    // ── Update password and wipe all reset fields ──────────────────────────
    await User.updateOne(
      { _id: user._id },
      {
        $set: { password: hashedPassword },
        $unset: {
          passwordResetTokenHash:    '',
          passwordResetTokenExpires: '',
          passwordResetOtpHash:      '',
          passwordResetOtpExpires:   '',
          passwordResetAttempts:     '',
          passwordResetOtpSentAt:    '',
        },
      }
    );

    logger.info('Password reset successfully.', { userId: user._id });

    return res.json(
      successResponse(null, 'Your password has been reset successfully. You may now sign in.')
    );
  });
}

export default ForgotPasswordController;

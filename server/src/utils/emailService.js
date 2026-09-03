// Email Service — SMTP-based OTP delivery
// Provider-independent: works with Gmail, Outlook, Zoho, SendGrid SMTP, etc.
import nodemailer from 'nodemailer';
import { config } from '../config/environment.js';
import { logger } from './logger.js';

/**
 * Creates a new Nodemailer transporter from environment SMTP config.
 * Provider-independent — any SMTP server is supported.
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
};

/**
 * Sends a professional password-reset OTP email.
 * The plaintext OTP is used only inside this function and is never logged or stored.
 *
 * @param {string} to        - Recipient email address
 * @param {string} otp       - 6-digit OTP (plaintext, never logged)
 * @param {string} [name]    - Recipient's first name for personalisation
 */
export const sendOtpEmail = async (to, otp, name = '') => {
  const transporter = createTransporter();
  const greeting = name ? `Hello ${name},` : 'Hello,';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password Reset OTP</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#e75914 0%,#bd420c 100%);padding:36px 40px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Aasha SM Tech CRM</p>
              <p style="margin:8px 0 0 0;font-size:13px;color:rgba(255,255,255,0.82);">Password Reset Request</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px 0;font-size:15px;color:#374151;">${greeting}</p>
              <p style="margin:0 0 28px 0;font-size:15px;color:#374151;line-height:1.6;">
                We received a request to reset the password for your Aasha SM Tech CRM account.
                Use the verification code below to proceed.
              </p>

              <!-- OTP Box -->
              <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 10px 0;font-size:12px;font-weight:600;color:#6b7280;letter-spacing:0.08em;text-transform:uppercase;">Your Verification Code</p>
                <p style="margin:0;font-size:44px;font-weight:800;letter-spacing:0.18em;color:#e75914;font-variant-numeric:tabular-nums;">${otp}</p>
                <p style="margin:12px 0 0 0;font-size:12px;color:#9ca3af;">This code expires in <strong>10 minutes</strong></p>
              </div>

              <p style="margin:0 0 16px 0;font-size:14px;color:#6b7280;line-height:1.6;">
                If you did not request a password reset, please ignore this email.
                Your password will remain unchanged and no action is needed.
              </p>

              <p style="margin:0;font-size:14px;color:#9ca3af;">
                For your security, never share this code with anyone.
                Aasha SM Tech will never ask for your verification code.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} Aasha SM Tech &mdash; CRM System<br/>
                This is an automated email. Please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${greeting}

PASSWORD RESET — AASHA SM TECH CRM

Your verification code is: ${otp}

This code will expire in 10 minutes.

If you did not request a password reset, please ignore this email.
Your password will remain unchanged.

For your security, never share this code with anyone.

— Aasha SM Tech CRM Team`;

  try {
    await transporter.sendMail({
      from: config.smtp.from,
      to,
      subject: 'Your Password Reset Code — Aasha SM Tech CRM',
      html,
      text,
    });
    // Log that an email was sent (without including the OTP)
    logger.info(`Password-reset OTP email dispatched`, { to });
  } catch (err) {
    logger.error('Failed to dispatch OTP email', { to, error: err.message });
    throw new Error('Unable to send the verification code right now. Please try again later.');
  }
};

export default { sendOtpEmail };

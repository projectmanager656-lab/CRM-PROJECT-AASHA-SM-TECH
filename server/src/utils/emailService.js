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

/**
 * Sends a professional Offer Letter email to the candidate.
 *
 * @param {string} to               - Candidate email address
 * @param {object} offerData        - OfferLetter document fields
 * @param {string} candidateName    - Candidate full name
 * @param {string} companyName      - Company name from CompanySetting
 * @param {string} [companyAddress] - Company address
 */
export const sendOfferEmail = async (to, offerData, candidateName, companyName = 'Aasha SM Technologies', companyAddress = '') => {
  const transporter = createTransporter();

  const fmtDate = (d) => {
    if (!d) return 'To be confirmed';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return String(d); }
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Offer Letter — ${companyName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.10);">
          <tr>
            <td style="background:linear-gradient(135deg,#e75914 0%,#bd420c 100%);padding:36px 40px;text-align:center;">
              <p style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">${companyName}</p>
              <p style="margin:8px 0 0 0;font-size:13px;color:rgba(255,255,255,0.82);">${companyAddress}</p>
              <p style="margin:16px 0 0 0;font-size:16px;font-weight:600;color:#fff;background:rgba(0,0,0,0.2);display:inline-block;padding:6px 20px;border-radius:20px;">OFFER LETTER</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#6b7280;">Offer No: <strong>${offerData.offerNumber || ''}</strong> &nbsp;|&nbsp; Date: <strong>${fmtDate(offerData.offerDate)}</strong></p>
              <p style="margin:0 0 24px 0;font-size:15px;color:#374151;">Dear <strong>${candidateName}</strong>,</p>
              <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
                We are delighted to extend an offer of employment to you at <strong>${companyName}</strong>. After careful consideration, we are pleased to offer you the position of:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:0;margin-bottom:24px;">
                <tr><td style="padding:20px 24px;">
                  <table width="100%" cellpadding="6" cellspacing="0">
                    <tr><td style="font-size:13px;color:#6b7280;width:50%;">Designation</td><td style="font-size:14px;font-weight:700;color:#0f172a;">${offerData.offeredDesignation || ''}</td></tr>
                    <tr><td style="font-size:13px;color:#6b7280;">Department</td><td style="font-size:14px;font-weight:700;color:#0f172a;">${offerData.department || ''}</td></tr>
                    <tr><td style="font-size:13px;color:#6b7280;">Employment Type</td><td style="font-size:14px;font-weight:700;color:#0f172a;">${offerData.employmentType || 'Full Time'}</td></tr>
                    <tr><td style="font-size:13px;color:#6b7280;">CTC / Salary</td><td style="font-size:14px;font-weight:700;color:#e75914;">${offerData.salary || 'As discussed'}</td></tr>
                    <tr><td style="font-size:13px;color:#6b7280;">Joining Date</td><td style="font-size:14px;font-weight:700;color:#0f172a;">${fmtDate(offerData.joiningDate)}</td></tr>
                    <tr><td style="font-size:13px;color:#6b7280;">Work Location</td><td style="font-size:14px;font-weight:700;color:#0f172a;">${offerData.workLocation || 'Office / As agreed'}</td></tr>
                    <tr><td style="font-size:13px;color:#6b7280;">Probation Period</td><td style="font-size:14px;font-weight:700;color:#0f172a;">${offerData.probationPeriod || '6 Months'}</td></tr>
                    <tr><td style="font-size:13px;color:#6b7280;">Working Hours</td><td style="font-size:14px;font-weight:700;color:#0f172a;">${offerData.workingHours || '9:00 AM – 6:00 PM'}</td></tr>
                    <tr><td style="font-size:13px;color:#6b7280;">Notice Period</td><td style="font-size:14px;font-weight:700;color:#0f172a;">${offerData.noticePeriod || '30 Days'}</td></tr>
                    ${offerData.reportingManager ? `<tr><td style="font-size:13px;color:#6b7280;">Reporting Manager</td><td style="font-size:14px;font-weight:700;color:#0f172a;">${offerData.reportingManager}</td></tr>` : ''}
                  </table>
                </td></tr>
              </table>
              ${offerData.termsAndConditions ? `<p style="font-size:14px;color:#374151;line-height:1.7;margin-bottom:16px;"><strong>Terms &amp; Conditions:</strong><br/>${offerData.termsAndConditions}</p>` : ''}
              <p style="font-size:14px;color:#374151;line-height:1.7;margin-bottom:16px;">
                Please confirm your acceptance of this offer by replying to this email or contacting your HR representative before <strong>${fmtDate(offerData.expiresAt)}</strong>.
              </p>
              ${offerData.additionalNotes ? `<p style="font-size:13px;color:#6b7280;line-height:1.6;">${offerData.additionalNotes}</p>` : ''}
              <p style="font-size:14px;color:#374151;margin-top:24px;">We look forward to welcoming you to our team!</p>
              <p style="font-size:14px;color:#374151;margin-top:8px;">Warm regards,<br/><strong>Human Resources</strong><br/>${companyName}</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} ${companyName} &mdash; HR Management System<br/>This is an automated offer letter. Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Dear ${candidateName},

OFFER LETTER — ${companyName}
Offer No: ${offerData.offerNumber || ''}
Date: ${fmtDate(offerData.offerDate)}

We are pleased to offer you the position of ${offerData.offeredDesignation} in the ${offerData.department} department.

Salary / CTC: ${offerData.salary || 'As discussed'}
Joining Date: ${fmtDate(offerData.joiningDate)}
Employment Type: ${offerData.employmentType || 'Full Time'}
Work Location: ${offerData.workLocation || 'Office'}
Probation Period: ${offerData.probationPeriod || '6 Months'}

Please confirm your acceptance before ${fmtDate(offerData.expiresAt)}.

Warm regards,
Human Resources
${companyName}`;

  try {
    await transporter.sendMail({
      from: config.smtp.from,
      to,
      subject: `Offer Letter — ${offerData.offeredDesignation} at ${companyName}`,
      html,
      text,
    });
    logger.info('Offer letter email dispatched', { to, offerNumber: offerData.offerNumber });
  } catch (err) {
    logger.error('Failed to dispatch offer letter email', { to, error: err.message });
    throw new Error(`Unable to send offer letter email: ${err.message}`);
  }
};

export default { sendOtpEmail, sendOfferEmail };

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import apiClient from '../../../services/apiClient';
import '../auth-flow.css';

const OTP_LENGTH       = 6;
const RESEND_COOLDOWN  = 60; // seconds

export default function VerifyOtp() {
  const location = useLocation();
  const navigate = useNavigate();

  // Guard: redirect if no email in state
  const email = location.state?.email || '';
  useEffect(() => {
    if (!email) navigate('/forgot-password', { replace: true });
  }, [email, navigate]);

  const [digits, setDigits]         = useState(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState('');
  const [shakeError, setShakeError] = useState(false);
  const [countdown, setCountdown]   = useState(RESEND_COOLDOWN);
  const [isResending, setIsResending] = useState(false);
  const [resendMsg, setResendMsg]   = useState('');
  const inputRefs = useRef([]);

  // ── Auto-focus first box on mount ────────────────────────────────────────
  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const formatCountdown = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const triggerShake = () => {
    setShakeError(true);
    setTimeout(() => setShakeError(false), 500);
  };

  const extractError = (err) => {
    const resp = err?.response?.data;
    if (!resp) return 'Unable to connect to server.';
    if (typeof resp.message === 'string' && resp.message) return resp.message;
    if (Array.isArray(resp.errors) && resp.errors.length) return resp.errors.join(' ');
    return 'Something went wrong. Please try again.';
  };

  // ── OTP input handlers ────────────────────────────────────────────────────
  const handleChange = (index, value) => {
    const char = value.replace(/\D/g, '').slice(-1); // only last digit
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setError('');

    if (char && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = [...digits];
    pasted.split('').forEach((ch, i) => { if (i < OTP_LENGTH) next[i] = ch; });
    setDigits(next);
    setError('');
    // Focus last filled box or last box
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) {
      setError('Please enter the complete 6-digit code.');
      triggerShake();
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/forgot-password/verify-otp', { email, otp });
      const { resetToken } = res.data.data || {};
      navigate('/reset-password', { state: { resetToken, email } });
    } catch (err) {
      const msg = extractError(err);
      setError(msg);
      triggerShake();
      // Clear digits on hard errors (expired / too many attempts)
      if (err?.response?.status === 400 &&
          (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('too many'))) {
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } finally {
      setIsLoading(false);
    }
  }, [digits, email, navigate]);

  // ── Auto-submit when all 6 digits filled ──────────────────────────────────
  useEffect(() => {
    if (digits.every(Boolean) && !isLoading) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setError('');
    setResendMsg('');
    setDigits(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();

    try {
      await apiClient.post('/auth/forgot-password/request-otp', { email });
      setResendMsg('A new verification code has been sent to your email.');
      setCountdown(RESEND_COOLDOWN);
    } catch (err) {
      const msg = extractError(err);
      setError(msg);
    } finally {
      setIsResending(false);
    }
  };

  if (!email) return null;

  return (
    <div className="auth-flow-container">
      <div className="auth-flow-card">
        {/* Header */}
        <div className="auth-flow-header">
          <img
            className="auth-flow-logo"
            src="/aasha-logo-new.jpg"
            alt="Aasha SM Tech"
          />
          <h1>Enter verification code</h1>
          <p>
            We've sent a 6-digit code to{' '}
            <span className="auth-flow-email-highlight">{email}</span>.
            Check your inbox (and spam folder).
          </p>
        </div>

        {/* Form */}
        <form className="auth-flow-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="auth-flow-error" role="alert">{error}</div>
          )}
          {resendMsg && !error && (
            <div className="auth-flow-success-msg" role="status">{resendMsg}</div>
          )}

          {/* 6 OTP boxes */}
          <div
            className="otp-boxes"
            role="group"
            aria-label="6-digit verification code"
            onPaste={handlePaste}
          >
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                id={`otp-box-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={isLoading}
                autoComplete="one-time-code"
                aria-label={`Digit ${i + 1}`}
                className={[
                  'otp-box',
                  digit ? 'otp-filled' : '',
                  shakeError ? 'otp-error' : '',
                ].filter(Boolean).join(' ')}
              />
            ))}
          </div>

          <button
            type="submit"
            className="auth-flow-btn"
            disabled={isLoading || digits.some((d) => !d)}
            aria-busy={isLoading}
          >
            {isLoading ? 'Verifying…' : 'Verify Code'}
          </button>
        </form>

        {/* Resend section */}
        <div className="otp-resend-section" style={{ marginTop: '1.25rem' }}>
          <p>Didn't receive the code?</p>
          {countdown > 0 ? (
            <span className="otp-countdown">
              Resend in {formatCountdown(countdown)}
            </span>
          ) : (
            <button
              type="button"
              className="otp-resend-btn"
              onClick={handleResend}
              disabled={isResending}
            >
              {isResending ? 'Sending…' : 'Resend OTP'}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="auth-flow-footer">
          <button
            type="button"
            className="auth-flow-back"
            onClick={() => navigate('/forgot-password')}
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}

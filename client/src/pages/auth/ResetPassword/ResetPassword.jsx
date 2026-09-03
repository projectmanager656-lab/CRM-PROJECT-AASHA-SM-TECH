import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import apiClient from '../../../services/apiClient';
import '../auth-flow.css';

/** Calculates password strength: 0 = none, 1 = weak, 2 = medium, 3 = strong */
const getStrength = (pwd) => {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 6)  score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
  return Math.min(score, 3);
};

const strengthLabel = ['', 'Weak', 'Medium', 'Strong'];
const strengthClass = ['', 'strength-weak', 'strength-medium', 'strength-strong'];

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();

  const resetToken = location.state?.resetToken || '';
  const email      = location.state?.email || '';

  // Guard: must have a reset token from the server
  useEffect(() => {
    if (!resetToken) navigate('/forgot-password', { replace: true });
  }, [resetToken, navigate]);

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [isLoading,       setIsLoading]       = useState(false);
  const [error,           setError]           = useState('');
  const [success,         setSuccess]         = useState(false);

  const strength      = getStrength(newPassword);
  const strengthText  = strengthLabel[strength];
  const strengthCls   = strengthClass[strength];

  const extractError = (err) => {
    const resp = err?.response?.data;
    if (!resp) return 'Unable to connect to server.';
    if (typeof resp.message === 'string' && resp.message) return resp.message;
    if (Array.isArray(resp.errors) && resp.errors.length) return resp.errors.join(' ');
    return 'Something went wrong. Please try again.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword) { setError('Please enter a new password.'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }

    setIsLoading(true);
    try {
      await apiClient.post('/auth/forgot-password/reset-password', {
        resetToken,
        newPassword,
        confirmPassword,
      });
      setSuccess(true);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (!resetToken) return null;

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="auth-flow-container">
        <div className="auth-flow-card">
          <div className="auth-success-state">
            <div className="auth-success-icon" aria-hidden="true">✓</div>
            <h2>Password Reset Successful</h2>
            <p>
              Your password has been updated successfully.
              You can now sign in with your new password.
            </p>
            <Link to="/login" className="auth-flow-btn" style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}>
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Reset password form ────────────────────────────────────────────────────
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
          <h1>Create a new password</h1>
          <p>
            Choose a strong password for your account
            {email ? (
              <> — <span className="auth-flow-email-highlight">{email}</span></>
            ) : ''}.
          </p>
        </div>

        {/* Form */}
        <form className="auth-flow-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="auth-flow-error" role="alert">{error}</div>
          )}

          {/* New Password */}
          <div className="auth-form-group">
            <label htmlFor="rp-new-password">New Password</label>
            <div className="auth-password-wrapper">
              <input
                id="rp-new-password"
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>

            {/* Password strength indicator */}
            {newPassword.length > 0 && (
              <>
                <div className="password-strength-bar" aria-hidden="true">
                  {[1, 2, 3].map((level) => (
                    <div
                      key={level}
                      className={`strength-segment ${strength >= level ? `active-${strengthText.toLowerCase()}` : ''}`}
                    />
                  ))}
                </div>
                <span className={`password-strength-label ${strengthCls}`}>
                  {strengthText} password
                </span>
              </>
            )}
          </div>

          {/* Confirm Password */}
          <div className="auth-form-group">
            <label htmlFor="rp-confirm-password">Confirm Password</label>
            <div className="auth-password-wrapper">
              <input
                id="rp-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repeat your new password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                disabled={isLoading}
                required
                className={
                  confirmPassword && confirmPassword !== newPassword ? 'input-error' : ''
                }
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <span style={{ fontSize: '0.76rem', color: 'var(--color-danger)', marginTop: '0.2rem' }}>
                Passwords do not match
              </span>
            )}
          </div>

          <button
            type="submit"
            className="auth-flow-btn"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? 'Resetting Password…' : 'Reset Password'}
          </button>
        </form>

        {/* Footer */}
        <div className="auth-flow-footer">
          <Link to="/login" className="auth-flow-back">
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

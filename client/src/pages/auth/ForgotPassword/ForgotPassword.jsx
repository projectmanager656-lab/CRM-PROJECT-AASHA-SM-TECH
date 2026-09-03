import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../../services/apiClient';
import '../auth-flow.css';

export default function ForgotPassword() {
  const [email, setEmail]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState('');
  const [sent, setSent]         = useState(false);
  const navigate                = useNavigate();

  const extractError = (err) => {
    const resp = err?.response?.data;
    if (!resp) return 'Unable to connect to server. Please try again.';
    if (typeof resp.message === 'string' && resp.message) return resp.message;
    if (Array.isArray(resp.errors) && resp.errors.length) return resp.errors.join(' ');
    return 'Something went wrong. Please try again.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post('/auth/forgot-password/request-otp', { email: trimmedEmail });
      // Always navigate to OTP page — backend gives generic response for security
      navigate('/verify-otp', { state: { email: trimmedEmail } });
    } catch (err) {
      const msg = extractError(err);
      // Show generic message for 4xx too — prevent account enumeration on frontend
      if (err?.response?.status === 400) {
        setError(msg);
      } else {
        setError('Unable to send the verification code right now. Please try again later.');
      }
      setIsLoading(false);
    }
  };

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
          <h1>Forgot your password?</h1>
          <p>
            No worries. Enter your registered email address and we'll send
            you a 6-digit verification code.
          </p>
        </div>

        {/* Form */}
        <form className="auth-flow-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="auth-flow-error" role="alert">
              {error}
            </div>
          )}

          <div className="auth-form-group">
            <label htmlFor="fp-email">Email Address</label>
            <input
              id="fp-email"
              type="email"
              autoComplete="email"
              placeholder="Enter your registered email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              disabled={isLoading}
              required
              aria-describedby={error ? 'fp-error' : undefined}
            />
          </div>

          <button
            type="submit"
            className="auth-flow-btn"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? 'Sending Code…' : 'Send Verification Code'}
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

import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppContext } from '../../../context/AppContext';
import '../Login/Login.css';

export default function SuperAdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { loginSuperAdmin } = useContext(AppContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await loginSuperAdmin(email, password);

    if (result.success) {
      navigate('/super-admin/dashboard');
    } else {
      setError(result.error || 'Super admin login failed');
    }

    setIsLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">IT CMS</div>
          <h1>Super Admin Portal</h1>
          <p>Restricted access for super administrators</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Super Admin Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter super admin email"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              disabled={isLoading}
            />
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Signing In...' : 'Super Admin Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <p>Back to <Link to="/login">User Login</Link></p>
          <p>Admin portal: <Link to="/admin/login">Admin Login</Link></p>
        </div>
      </div>
    </div>
  );
}

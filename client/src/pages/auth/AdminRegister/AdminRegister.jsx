import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppContext } from '../../../context/AppContext';
import '../Register/Register.css';

export default function AdminRegister() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { registerAdmin } = useContext(AppContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    const result = await registerAdmin(
      formData.email,
      formData.password,
      formData.firstName,
      formData.lastName
    );

    if (result.success) {
      setSuccess('Admin registration successful! Redirecting...');

      const role = String(result.user?.role || '').trim().toLowerCase();
      setTimeout(() => {
        if (role === 'admin') {
          navigate('/admin/dashboard');
        } else if (role === 'super_admin') {
          navigate('/super-admin/dashboard');
        } else {
          navigate('/dashboard');
        }
      }, 800);
    } else {
      setError(result.error || 'Admin registration failed');
    }

    setIsLoading(false);
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-header">
          <div className="register-logo">IT CMS</div>
          <h1>Admin Registration</h1>
          <p>Create an admin account</p>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          {error && <div className="register-error">{error}</div>}
          {success && <div className="register-success">{success}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input id="firstName" name="firstName" type="text" value={formData.firstName} onChange={handleChange} placeholder="Enter first name" disabled={isLoading} />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input id="lastName" name="lastName" type="text" value={formData.lastName} onChange={handleChange} placeholder="Enter last name" disabled={isLoading} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="Enter admin email" required disabled={isLoading} />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} placeholder="Enter password (min 6 characters)" required disabled={isLoading} />
            <small>Password must be at least 6 characters</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} placeholder="Confirm password" required disabled={isLoading} />
          </div>

          <button type="submit" className="register-button" disabled={isLoading}>
            {isLoading ? 'Creating Admin Account...' : 'Create Admin Account'}
          </button>
        </form>

        <div className="register-footer">
          <p>Already an admin? <Link to="/admin/login">Admin Sign In</Link></p>
        </div>
      </div>
    </div>
  );
}

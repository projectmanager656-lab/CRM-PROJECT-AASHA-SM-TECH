import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppContext } from '../../../context/AppContext';
import apiClient from '../../../services/apiClient';
import { DEPARTMENTS } from '../../../config/departments';
import './Register.css';

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    department: '',
  });
  const departments = DEPARTMENTS;
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useContext(AppContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    // Validate password strength
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    const result = await register(
      formData.email,
      formData.password,
      formData.firstName,
      formData.lastName,
      formData.department
    );

    if (result.success) {
      setSuccess('Registration successful! Redirecting...');

      // If backend provided token, user is authenticated already
      const role = String(result.user?.role || '').trim().toLowerCase();

      setTimeout(() => {
        if (role === 'super_admin') {
          navigate('/super-admin/dashboard');
        } else if (role === 'admin') {
          navigate('/admin/dashboard');
        } else {
          navigate('/dashboard');
        }
      }, 800);
    } else {
      setError(result.error || 'Registration failed');
    }

    setIsLoading(false);
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-header">
          <img className="auth-brand-logo" src="/aasha-sm-logo.jpeg" alt="Aasha SM Tech" />
          <div className="register-logo">Aasha SM Tech</div>
          <h1>Create Account</h1>
          <p>Join the Aasha SM Tech CRM System</p>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          {error && <div className="register-error">{error}</div>}
          {success && <div className="register-success">{success}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                id="firstName"
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter your first name"
                disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                id="lastName"
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Enter your last name"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password (min 6 characters)"
              required
              disabled={isLoading}
            />
            <small>Password must be at least 6 characters</small>
          </div>

          <div className="form-group">
            <label htmlFor="department">Department</label>
            <select
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
              disabled={isLoading}
            >
              <option value="">Select Department</option>
              {departments.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
          </div>

          <button
            type="submit"
            className="register-button"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="register-footer">
          <p>Already have an account? <Link to="/login">Sign In</Link></p>
        </div>
      </div>
    </div>
  );
}

import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import styles from './Home.module.css';

export default function Home() {
  const { isAuthenticated, user, logout } = useContext(AppContext);

  if (isAuthenticated && user) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1>Welcome, {user.firstName}!</h1>
          <p className={styles.subtitle}>IT Company Management System - Phase 2</p>
          
          <div className={styles.userInfo}>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Role:</strong> {user.role.replace('_', ' ').toUpperCase()}</p>
            <p><strong>Status:</strong> {user.isActive ? 'Active' : 'Inactive'}</p>
          </div>

          <div className={styles.actions}>
            {user.role === 'employee' && (
              <Link to="/user" className={styles.btn}>
                Go to User Dashboard
              </Link>
            )}
            {(user.role === 'admin' || user.role === 'super_admin') && (
              <Link to="/admin" className={styles.btn}>
                Go to Admin Dashboard
              </Link>
            )}
            {user.role === 'super_admin' && (
              <Link to="/super-admin" className={styles.btn}>
                Go to Super Admin Dashboard
              </Link>
            )}
          </div>

          <button className={styles.btnSecondary} onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>IT Company Management System</h1>
        <p className={styles.subtitle}>Phase 2: Authentication</p>
        
        <p className={styles.description}>
          A comprehensive management system for IT companies with features for CRM, HRMS, 
          Payroll Management, and Project Management.
        </p>

        <div className={styles.features}>
          <h3>Features:</h3>
          <ul>
            <li>✓ User Authentication with JWT</li>
            <li>✓ Role-based Access Control</li>
            <li>✓ Secure Password Hashing</li>
            <li>✓ MongoDB Integration</li>
            <li>✓ Protected Routes</li>
          </ul>
        </div>

        <div className={styles.actions}>
          <Link to="/login" className={styles.btn}>
            Sign In
          </Link>
          <Link to="/register" className={styles.btnSecondary}>
            Create Account
          </Link>
        </div>

        <p className={styles.demo}>
          Demo credentials will be available after registration.
        </p>
      </div>
    </div>
  );
}

import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../../../../context/AppContext';
import apiClient from '../../../../../services/apiClient';
import './Users.css';

const defaultForm = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'employee',
  password: '',
  isActive: true,
};

export default function Users() {
  const { user, logout } = useContext(AppContext);
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);

  const isAuthorized = user && ['admin', 'super_admin'].includes(user.role);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    if (!isAuthorized) {
      navigate('/unauthorized', { replace: true });
      return;
    }

    fetchUsers();
  }, [user, isAuthorized, navigate]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.get('/users');
      setUsers(response.data.data || []);
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to load users';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(defaultForm);
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = { ...form };

      if (!editingId && !payload.password) {
        throw new Error('Password is required to create a user');
      }

      if (editingId && !payload.password) {
        delete payload.password;
      }

      if (editingId) {
        await apiClient.put(`/users/${editingId}`, payload);
      } else {
        await apiClient.post('/users', payload);
      }

      resetForm();
      await fetchUsers();
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Unable to save user';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (selectedUser) => {
    setEditingId(selectedUser._id);
    setForm({
      firstName: selectedUser.firstName || '',
      lastName: selectedUser.lastName || '',
      email: selectedUser.email || '',
      role: selectedUser.role || 'employee',
      password: '',
      isActive: selectedUser.isActive !== false,
    });
    setError('');
  };

  const handleDelete = async (selectedUser) => {
    if (!selectedUser || selectedUser._id === user?._id) {
      setError('You cannot deactivate your own account from this screen.');
      return;
    }

    const confirmed = window.confirm(
      `Deactivate ${selectedUser.firstName || selectedUser.email}? This action can be reversed by an admin.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await apiClient.delete(`/users/${selectedUser._id}`);
      await fetchUsers();
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to deactivate user';
      setError(message);
    }
  };

  const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString();
  };

  return (
    <div className="users-page">
      <header className="users-header">
        <div className="users-header-content">
          <div>
            <p className="eyebrow">Administration</p>
            <h1>User Management</h1>
          </div>
          <div className="users-header-actions">
            <button type="button" className="secondary-button" onClick={() => navigate('/admin')}>
              Dashboard
            </button>
            <button type="button" className="logout-button" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="users-page-inner">
        <div className="users-layout">
          <aside className="user-card user-form-card">
            <div className="card-header">
              <h2>{editingId ? 'Edit User' : 'Add User'}</h2>
            </div>

            <form onSubmit={handleSubmit} className="user-form">
              {error && <div className="form-error">{error}</div>}

              <div className="form-row">
                <label>
                  First Name
                  <input
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    required
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Last Name
                  <input
                    type="text"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    required
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Email
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Role
                  <select name="role" value={form.role} onChange={handleChange}>
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Password
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder={editingId ? 'Leave blank to keep current password' : 'Enter password'}
                  />
                </label>
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleChange}
                />
                Active account
              </label>

              <div className="form-actions">
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Update User' : 'Create User'}
                </button>
                {editingId && (
                  <button type="button" className="secondary-button" onClick={resetForm}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </aside>

          <section className="user-card user-list-card">
            <div className="card-header">
              <h2>Users</h2>
              <span className="badge">{users.length} total</span>
            </div>

            {loading ? (
              <div className="table-state">Loading users...</div>
            ) : error ? (
              <div className="table-state error-state">{error}</div>
            ) : users.length === 0 ? (
              <div className="table-state">No users found.</div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((row) => (
                      <tr key={row._id}>
                        <td>{`${row.firstName || ''} ${row.lastName || ''}`.trim() || '—'}</td>
                        <td>{row.email}</td>
                        <td>
                          <span className={`role-badge role-${row.role || 'employee'}`}>
                            {row.role || 'employee'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${row.isActive === false ? 'inactive' : 'active'}`}>
                            {row.isActive === false ? 'Inactive' : 'Active'}
                          </span>
                        </td>
                        <td>{formatDate(row.createdAt)}</td>
                        <td>
                          <div className="action-buttons">
                            <button type="button" className="table-button" onClick={() => handleEdit(row)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="table-button danger"
                              onClick={() => handleDelete(row)}
                              disabled={row._id === user?._id}
                            >
                              Deactivate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

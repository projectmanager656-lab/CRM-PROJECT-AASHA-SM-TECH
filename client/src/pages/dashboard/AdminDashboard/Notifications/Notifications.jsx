import { useEffect, useState } from 'react';
import apiClient from '../../../../services/apiClient';
import AdminLayout from '../components/AdminLayout';
import './Notifications.css';

const initialForm = {
  recipient: '',
  title: '',
  message: '',
  type: 'Info',
};

const message = (error) => error.response?.data?.message || 'Unable to load notifications.';
const ago = (value) => {
  const minutes = Math.floor((Date.now() - new Date(value)) / 60000);
  return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
};
const name = (user) => (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown user');

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(initialForm);
  const [sending, setSending] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/notifications');
      setNotifications(response.data.data || []);
      setError('');
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setRecipientsLoading(true);
    try {
      const response = await apiClient.get('/users');
      setUsers(response.data.data || []);
    } catch {
      setUsers([]);
    } finally {
      setRecipientsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    loadUsers();
  }, []);

  const refreshBadges = () => window.dispatchEvent(new Event('notifications:updated'));

  const action = async (method, url, data) => {
    try {
      await apiClient[method](url, data);
      await loadNotifications();
      refreshBadges();
    } catch (e) {
      setError(message(e));
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    try {
      await apiClient.post('/notifications', form);
      setForm(initialForm);
      await loadNotifications();
      refreshBadges();
    } catch (e) {
      setError(message(e));
    } finally {
      setSending(false);
    }
  };

  const recipientOptions = users.filter((item) => item.role !== 'super_admin');

  return (
    <AdminLayout pageTitle="Notifications">
      <div className="admin-page">
        <div className="admin-page-header">
          <h2>Notification Center</h2>
          <div className="admin-page-header-actions">
            <button type="button" className="ghost-btn" onClick={() => action('patch', '/notifications/read-all')}>
              Mark All Read
            </button>
          </div>
        </div>

        {error && <div className="admin-resource-message error">{error}</div>}

        <section className="notification-compose admin-card">
          <div className="notification-compose-header">
            <div>
              <span className="page-kicker">Broadcast</span>
              <h3>Send Notification</h3>
            </div>
            <p>Message a specific employee and it will appear inside their dashboard inbox immediately.</p>
          </div>

          <form className="notification-compose-form" onSubmit={submit}>
            <label>
              <span>Recipient</span>
              <select
                required
                value={form.recipient}
                onChange={(event) => setForm({ ...form, recipient: event.target.value })}
                disabled={recipientsLoading}
              >
                <option value="">{recipientsLoading ? 'Loading users...' : 'Select employee'}</option>
                {recipientOptions.map((item) => (
                  <option key={item._id} value={item._id}>
                    {name(item)} {item.email ? `(${item.email})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Type</span>
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                {['Info', 'Success', 'Warning', 'Error'].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="notification-title">
              <span>Title</span>
              <input
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Enter a short title"
              />
            </label>

            <label className="notification-message">
              <span>Message</span>
              <textarea
                required
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                placeholder="Write the notification message"
              />
            </label>

            <div className="notification-compose-actions">
              <button className="primary-btn" disabled={sending}>
                {sending ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </form>
        </section>

        <div className="notification-list">
          {loading ? (
            <div className="admin-resource-empty">Loading...</div>
          ) : notifications.length ? (
            notifications.map((notification) => (
              <article
                key={notification._id}
                className={`notification-item admin-card ${notification.isRead ? 'read' : 'unread'}`}
              >
                <span className={`notif-indicator ${String(notification.type || 'info').toLowerCase()}`} />
                <div className="notif-content">
                  <h3>{notification.title}</h3>
                  <p>{notification.message}</p>
                  <small>To: {name(notification.recipient)}</small>
                </div>
                <div className="notif-meta">
                  <strong>{ago(notification.createdAt)}</strong>
                  <div className="action-buttons">
                    {!notification.isRead && (
                      <button
                        type="button"
                        className="action-btn view"
                        onClick={() => action('patch', `/notifications/${notification._id}/read`)}
                      >
                        Read
                      </button>
                    )}
                    <button
                      type="button"
                      className="action-btn delete"
                      onClick={() => action('delete', `/notifications/${notification._id}`)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="admin-resource-empty">No notifications found.</div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

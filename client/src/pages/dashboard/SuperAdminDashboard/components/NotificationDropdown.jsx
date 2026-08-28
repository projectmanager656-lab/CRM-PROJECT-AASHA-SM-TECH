import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../../services/apiClient';
import { AppContext } from '../../../../context/AppContext';

export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useContext(AppContext);

  const fetchNotifications = async () => {
    try {
      const response = await apiClient.get('/notifications');
      const data = response.data.data;
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.isRead).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Optional: poll every minute
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (e, id) => {
    e.stopPropagation();
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async (e) => {
    e.stopPropagation();
    try {
      await apiClient.patch('/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = (n) => {
    if (!n.isRead) markAsRead({ stopPropagation: () => {} }, n._id);
    setIsOpen(false);
    // If we have target info in notification we could navigate, otherwise just close.
  };

  return (
    <div className="header-dropdown-container" ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        type="button" 
        className="header-icon-button" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="header-dropdown-menu">
          <div className="header-dropdown-header">
            <h4>Notifications</h4>
            {unreadCount > 0 && (
              <button type="button" className="text-button" onClick={markAllAsRead}>
                Mark all as read
              </button>
            )}
          </div>
          <div className="header-dropdown-body">
            {notifications.length === 0 ? (
              <div className="header-dropdown-empty">No notifications yet</div>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <div 
                  key={n._id} 
                  className={`header-dropdown-item ${!n.isRead ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="header-dropdown-item-content">
                    <p className="item-title">{n.title}</p>
                    <p className="item-desc">{n.message}</p>
                    <span className="item-time">{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  {!n.isRead && (
                    <button 
                      type="button" 
                      className="mark-read-btn" 
                      onClick={(e) => markAsRead(e, n._id)}
                      title="Mark as read"
                    >
                      ●
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="header-dropdown-footer">
            <button 
              type="button" 
              className="view-all-btn" 
              onClick={() => { setIsOpen(false); navigate('/super-admin/notifications'); }}
            >
              View All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

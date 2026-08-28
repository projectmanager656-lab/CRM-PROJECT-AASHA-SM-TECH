import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import { AppContext } from '../../context/AppContext';

export default function MessageDropdown() {
  const [conversations, setConversations] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useContext(AppContext);

  const fetchMessages = async () => {
    try {
      const response = await apiClient.get('/messages/conversations');
      const data = response.data.data || [];
      setConversations(data);
      
      const countRes = await apiClient.get('/messages/unread-count');
      setUnreadCount(countRes.data.data.count || 0);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 60000);
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

  const getInitials = (first, last, email) => {
    if (first && last) return (first[0] + last[0]).toUpperCase();
    if (first) return first.slice(0, 2).toUpperCase();
    return email ? email.slice(0, 2).toUpperCase() : 'U';
  };

  return (
    <div className="header-dropdown-container" ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        type="button" 
        className="header-icon-button" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Messages"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '20px', height: '20px'}}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="header-dropdown-menu">
          <div className="header-dropdown-header">
            <h4>Messages</h4>
          </div>
          <div className="header-dropdown-body">
            {conversations.length === 0 ? (
              <div className="header-dropdown-empty">No messages yet</div>
            ) : (
              conversations.slice(0, 5).map((c) => (
                <div 
                  key={c.contactId} 
                  className={`header-dropdown-item message-item ${c.unreadCount > 0 ? 'unread' : ''}`}
                  onClick={() => {
                    setIsOpen(false);
                    // Determine route base based on current user role for universal access
                    const baseRoute = user.role === 'super_admin' ? '/super-admin' : (user.role === 'admin' ? '/admin' : '/user');
                    navigate(`${baseRoute}/inbox?user=${c.contactId}&model=${c.contactModel || 'User'}`);
                  }}
                >
                  <div className="message-avatar">
                    {getInitials(c.firstName, c.lastName, c.email)}
                  </div>
                  <div className="header-dropdown-item-content">
                    <div className="message-header">
                      <p className="item-title">{c.firstName} {c.lastName}</p>
                      <span className="item-time">{new Date(c.latestMessage.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="item-desc truncate">{c.latestMessage.content}</p>
                  </div>
                  {c.unreadCount > 0 && <span className="unread-dot">{c.unreadCount}</span>}
                </div>
              ))
            )}
          </div>
          <div className="header-dropdown-footer">
            <button 
              type="button" 
              className="view-all-btn" 
              onClick={() => {
                setIsOpen(false);
                const baseRoute = user?.role === 'super_admin' ? '/super-admin' : (user?.role === 'admin' ? '/admin' : '/user');
                navigate(`${baseRoute}/inbox`);
              }}
            >
              View Inbox
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

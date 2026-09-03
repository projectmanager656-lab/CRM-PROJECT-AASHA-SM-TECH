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
        <div 
          className="header-dropdown-menu compact-message-popup"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            width: '280px',
            background: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            padding: '16px',
            zIndex: 1000,
            marginTop: '12px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Messages</h4>
            {unreadCount > 0 && (
              <span style={{ background: '#E85D04', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                {unreadCount} New
              </span>
            )}
          </div>
          
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
            {unreadCount > 0 
              ? `You have ${unreadCount} unread message${unreadCount === 1 ? '' : 's'}.` 
              : 'You are all caught up!'}
          </p>

          <button 
            type="button" 
            style={{
              background: '#0B0F19',
              color: '#ffffff',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '6px',
              width: '100%',
              marginTop: '4px',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#1e293b'}
            onMouseOut={(e) => e.target.style.background = '#0B0F19'}
            onClick={() => {
              setIsOpen(false);
              const baseRoute = user?.role === 'super_admin' ? '/super-admin' : (user?.role === 'admin' ? '/admin' : '/user');
              navigate(`${baseRoute}/inbox`);
            }}
          >
            View Messages &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

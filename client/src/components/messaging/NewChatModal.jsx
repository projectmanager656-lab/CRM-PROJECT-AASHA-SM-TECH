import { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import './NewChatModal.css';

export default function NewChatModal({ isOpen, onClose, onSelectUser }) {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    const fetchContacts = async () => {
      try {
        setLoading(true);
        setError('');
        
        const response = await apiClient.get('/messages/contacts');
        if (active) {
          setContacts(response.data.data || []);
        }
      } catch (err) {
        console.error('Error fetching contacts:', err);
        if (active) {
          setError('Unable to load contacts. Please try again.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchContacts();

    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredContacts = contacts.filter(contact => {
    const term = search.toLowerCase();
    const nameMatch = contact.name && contact.name.toLowerCase().includes(term);
    const emailMatch = contact.email && contact.email.toLowerCase().includes(term);
    const roleMatch = contact.role && contact.role.toLowerCase().includes(term);
    return nameMatch || emailMatch || roleMatch;
  });

  const getInitials = (name, email) => {
    if (name && name !== 'User') {
      const parts = name.split(' ');
      if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    return email ? email.slice(0, 2).toUpperCase() : 'U';
  };

  return (
    <div className="modal-overlay">
      <div className="new-chat-modal">
        <div className="modal-header">
          <h3>New Conversation</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        
        <div className="modal-search">
          <input 
            type="text" 
            placeholder="Search employees, admins and superadmins..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        
        <div className="modal-body">
          {loading ? (
            <div className="loading-state">Loading contacts...</div>
          ) : error ? (
            <div className="error-state" style={{ color: 'red', textAlign: 'center', padding: '2rem' }}>{error}</div>
          ) : filteredContacts.length === 0 ? (
            <div className="empty-state">No users found</div>
          ) : (
            <div className="contacts-list">
              {filteredContacts.map(contact => (
                <div 
                  key={contact.id} 
                  className="contact-item"
                  onClick={() => onSelectUser(contact)}
                >
                  <div className="contact-avatar">
                    {getInitials(contact.name, contact.email)}
                  </div>
                  <div className="contact-info">
                    <h4>{contact.name}</h4>
                    <span className="contact-role">
                      {contact.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

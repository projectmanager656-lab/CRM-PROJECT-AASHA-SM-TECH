import { useState, useEffect, useContext, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../../../services/apiClient';
import { AppContext } from '../../../context/AppContext';
import './Inbox.css';
import UserLayout from '../UserDashboard/users/components/UserLayout';
import AdminLayout from '../AdminDashboard/components/AdminLayout';
import SuperAdminLayout from '../SuperAdminDashboard/components/SuperAdminLayout';
import NewChatModal from '../../../components/messaging/NewChatModal';

export default function Inbox() {
  const { user } = useContext(AppContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialContactId = searchParams.get('user');
  const initialContactModel = searchParams.get('model');

  const [conversations, setConversations] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const messagesEndRef = useRef(null);

  // Select Layout based on role
  const Layout = user?.role === 'super_admin' ? SuperAdminLayout : (user?.role === 'admin' ? AdminLayout : UserLayout);

  const fetchConversations = async () => {
    try {
      const response = await apiClient.get('/messages/conversations');
      const data = response.data.data || [];
      setConversations(data);
      
      if (initialContactId && !activeContact) {
        const contact = data.find(c => c.contactId === initialContactId);
        if (contact) {
          setActiveContact(contact);
        } else {
          setActiveContact({ 
            contactId: initialContactId, 
            contactModel: initialContactModel || 'User',
            firstName: 'New', 
            lastName: 'Chat' 
          });
        }
      } else if (data.length > 0 && !activeContact) {
        setActiveContact(data[0]);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (contactId) => {
    try {
      const response = await apiClient.get(`/messages/${contactId}`);
      setMessages(response.data.data || []);
      
      await apiClient.patch(`/messages/${contactId}/read`);
      setConversations(prev => prev.map(c => c.contactId === contactId ? { ...c, unreadCount: 0 } : c));
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (activeContact) {
      fetchMessages(activeContact.contactId);
      const interval = setInterval(() => fetchMessages(activeContact.contactId), 15000);
      
      setSearchParams({ user: activeContact.contactId, model: activeContact.contactModel || activeContact.model || 'User' }, { replace: true });
      
      return () => clearInterval(interval);
    }
  }, [activeContact]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeContact) return;

    try {
      const content = newMessage.trim();
      setNewMessage('');
      
      const optimisticMessage = {
        _id: Date.now().toString(),
        sender: user.userId,
        recipient: activeContact.contactId,
        content: content,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, optimisticMessage]);

      await apiClient.post('/messages', {
        recipientId: activeContact.contactId,
        recipientModel: activeContact.contactModel || activeContact.model || 'User',
        content: content
      });
      
      fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSelectNewUser = (selectedUser) => {
    setIsModalOpen(false);
    
    // selectedUser contains { id, contactId, name, firstName, lastName, email, role, model }
    
    // Check if conversation already exists
    const existingConv = conversations.find(c => c.contactId === selectedUser.contactId);
    if (existingConv) {
      setActiveContact(existingConv);
    } else {
      // Start a new conversation state
      setActiveContact({
        contactId: selectedUser.contactId,
        contactModel: selectedUser.model,
        firstName: selectedUser.firstName || selectedUser.name.split(' ')[0],
        lastName: selectedUser.lastName || selectedUser.name.split(' ').slice(1).join(' '),
        email: selectedUser.email,
        role: selectedUser.role, // This is already normalized from backend like 'Super Admin', 'Admin', 'Employee'
        model: selectedUser.model
      });
      setMessages([]); // No messages yet
    }
  };

  const getInitials = (first, last, email) => {
    if (first && last) return (first[0] + last[0]).toUpperCase();
    if (first) return first.slice(0, 2).toUpperCase();
    return email ? email.slice(0, 2).toUpperCase() : 'U';
  };

  return (
    <Layout pageTitle="Inbox">
      <div className="inbox-container">
        <div className="inbox-sidebar">
          <div className="inbox-sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Conversations</h3>
            <button className="new-chat-btn" onClick={() => setIsModalOpen(true)}>+ New Chat</button>
          </div>
          <div className="conversations-list">
            {loading ? (
              <div className="inbox-loading">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="inbox-empty">No conversations found</div>
            ) : (
              conversations.map(c => (
                <div 
                  key={c.contactId} 
                  className={`conversation-item ${activeContact?.contactId === c.contactId ? 'active' : ''} ${c.unreadCount > 0 ? 'unread' : ''}`}
                  onClick={() => setActiveContact(c)}
                >
                  <div className="conversation-avatar">
                    {getInitials(c.firstName, c.lastName, c.email)}
                  </div>
                  <div className="conversation-info">
                    <div className="conversation-header">
                      <h4>{c.firstName} {c.lastName}</h4>
                      <span className="time">{new Date(c.latestMessage.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="conversation-preview">
                      <p className="truncate">{c.latestMessage.content}</p>
                      {c.unreadCount > 0 && <span className="unread-badge">{c.unreadCount}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="inbox-main">
          {activeContact ? (
            <>
              <div className="chat-header">
                <div className="chat-avatar">
                  {getInitials(activeContact.firstName, activeContact.lastName, activeContact.email)}
                </div>
                <div>
                  <h3>{activeContact.firstName} {activeContact.lastName}</h3>
                  <p>{
                    activeContact.role && (activeContact.role === 'Super Admin' || activeContact.role === 'Admin' || activeContact.role === 'Employee') 
                      ? activeContact.role 
                      : (activeContact.role || 'Employee').replace('_', ' ').replace(/\b\w/g, char => char.toUpperCase())
                  }</p>
                </div>
              </div>
              
              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-empty">Send a message to start the conversation</div>
                ) : (
                  messages.map(msg => (
                    <div key={msg._id} className={`message-bubble ${msg.sender === user.userId ? 'sent' : 'received'}`}>
                      <div className="message-content">{msg.content}</div>
                      <div className="message-time">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <div className="chat-input-area">
                <form onSubmit={handleSendMessage}>
                  <input 
                    type="text" 
                    placeholder="Type a message..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <button type="submit" disabled={!newMessage.trim()} className="send-btn">
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="chat-placeholder">
              <span className="placeholder-icon">✉️</span>
              <h3>Your Messages</h3>
              <p>Select a conversation or start a new chat</p>
              <button className="start-chat-btn" onClick={() => setIsModalOpen(true)}>+ New Chat</button>
            </div>
          )}
        </div>
      </div>
      
      <NewChatModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSelectUser={handleSelectNewUser}
      />
    </Layout>
  );
}

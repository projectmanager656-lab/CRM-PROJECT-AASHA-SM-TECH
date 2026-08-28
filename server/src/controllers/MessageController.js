import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import SuperAdmin from '../models/SuperAdmin.js';
import { successResponse } from '../utils/apiResponse.js';

const getModelByRole = (role) => {
  if (role === 'super_admin') return 'SuperAdmin';
  if (role === 'admin') return 'Admin';
  return 'User';
};

const getModelClass = (modelName) => {
  if (modelName === 'SuperAdmin') return SuperAdmin;
  if (modelName === 'Admin') return Admin;
  return User;
};

export const MessageController = {
  // Get all contacts the user can chat with
  getContacts: async (req, res) => {
    try {
      const currentUserId = req.user.userId;
      
      const query = { isActive: true, _id: { $ne: currentUserId } };
      
      const users = await User.find(query).select('firstName lastName email role isActive').lean();
      const admins = await Admin.find(query).select('firstName lastName email role isActive').lean();
      const superAdmins = await SuperAdmin.find(query).select('firstName lastName email role isActive').lean();

      // Transform to match the UI requirements
      const formatContact = (contact, modelName) => ({
        id: contact._id.toString(),
        contactId: contact._id.toString(), // Keep for backwards compatibility
        firstName: contact.firstName || contact.email?.split('@')[0] || 'User',
        lastName: contact.lastName || '',
        name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email?.split('@')[0] || 'User',
        email: contact.email,
        role: contact.role === 'super_admin' ? 'Super Admin' : (contact.role === 'admin' ? 'Admin' : 'Employee'),
        model: modelName,
        status: contact.isActive ? 'Active' : 'Inactive'
      });

      const contacts = [
        ...users.map(u => formatContact(u, 'User')),
        ...admins.map(a => formatContact(a, 'Admin')),
        ...superAdmins.map(sa => formatContact(sa, 'SuperAdmin'))
      ];

      res.json(successResponse(contacts, 'Contacts retrieved successfully'));
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch contacts', error: error.message });
    }
  },

  // Get all recent conversations for the logged-in user
  getConversations: async (req, res) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.user.userId);

      // Find the most recent message with each contact
      const conversations = await Message.aggregate([
        {
          $match: {
            $or: [{ sender: userId }, { recipient: userId }]
          }
        },
        {
          $sort: { createdAt: -1 }
        },
        {
          $group: {
            _id: {
              contactId: {
                $cond: {
                  if: { $eq: ['$sender', userId] },
                  then: '$recipient',
                  else: '$sender'
                }
              },
              contactModel: {
                $cond: {
                  if: { $eq: ['$sender', userId] },
                  then: '$recipientModel',
                  else: '$senderModel'
                }
              }
            },
            latestMessage: { $first: '$$ROOT' },
            unreadCount: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$recipient', userId] }, { $eq: ['$isRead', false] }] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      // Populate user details for each conversation manually since it's polymorphic across different collections
      const formattedConversations = [];
      
      for (const conv of conversations) {
        const Model = getModelClass(conv._id.contactModel);
        const contact = await Model.findById(conv._id.contactId).select('firstName lastName email role').lean();
        
        if (contact) {
          formattedConversations.push({
            contactId: contact._id,
            contactModel: conv._id.contactModel,
            firstName: contact.firstName || contact.email?.split('@')[0] || 'User',
            lastName: contact.lastName || '',
            email: contact.email,
            role: contact.role,
            latestMessage: conv.latestMessage,
            unreadCount: conv.unreadCount
          });
        }
      }
      
      formattedConversations.sort((a, b) => new Date(b.latestMessage.createdAt) - new Date(a.latestMessage.createdAt));

      res.json(successResponse(formattedConversations, 'Conversations retrieved successfully'));
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch conversations', error: error.message });
    }
  },

  // Get messages with a specific user
  getMessagesWithUser: async (req, res) => {
    try {
      const userId = req.user.userId;
      const { contactId } = req.params;

      const messages = await Message.find({
        $or: [
          { sender: userId, recipient: contactId },
          { sender: contactId, recipient: userId }
        ]
      })
      .sort({ createdAt: 1 })
      .limit(200);

      res.json(successResponse(messages, 'Messages retrieved successfully'));
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch messages', error: error.message });
    }
  },

  // Send a message
  sendMessage: async (req, res) => {
    try {
      const senderId = req.user.userId;
      const senderRole = req.user.role;
      const senderModel = getModelByRole(senderRole);
      
      const { recipientId, recipientModel, content } = req.body;

      if (!recipientId || !recipientModel || !content) {
        return res.status(400).json({ success: false, message: 'Recipient ID, recipient model, and content are required' });
      }

      // Verify recipient exists
      const RecipientModelClass = getModelClass(recipientModel);
      const recipient = await RecipientModelClass.findById(recipientId);
      if (!recipient) {
        return res.status(404).json({ success: false, message: 'Recipient not found' });
      }

      const message = new Message({
        sender: senderId,
        senderModel: senderModel,
        recipient: recipientId,
        recipientModel: recipientModel,
        content: content.trim()
      });

      await message.save();
      res.status(201).json(successResponse(message, 'Message sent successfully'));
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
    }
  },

  // Mark all messages from a specific user as read
  markAsRead: async (req, res) => {
    try {
      const userId = req.user.userId;
      const { contactId } = req.params;

      await Message.updateMany(
        { sender: contactId, recipient: userId, isRead: false },
        { $set: { isRead: true } }
      );

      res.json(successResponse(null, 'Messages marked as read'));
    } catch (error) {
      console.error('Error marking messages as read:', error);
      res.status(500).json({ success: false, message: 'Failed to mark messages as read', error: error.message });
    }
  },

  // Get total unread count for current user
  getUnreadCount: async (req, res) => {
    try {
      const userId = req.user.userId;
      const count = await Message.countDocuments({ recipient: userId, isRead: false });
      res.json(successResponse({ count }, 'Unread count retrieved'));
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch unread count', error: error.message });
    }
  }
};

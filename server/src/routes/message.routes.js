import { Router } from 'express';
import { MessageController } from '../controllers/MessageController.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

// All message routes require authentication
router.use(authenticateToken);

// Get conversations list
router.get('/conversations', MessageController.getConversations);

// Get total unread count
router.get('/unread-count', MessageController.getUnreadCount);

// Get contacts list for new chat
router.get('/contacts', MessageController.getContacts);

// Get messages with a specific user
router.get('/:contactId', MessageController.getMessagesWithUser);

// Send a new message
router.post('/', MessageController.sendMessage);

// Mark messages from a specific user as read
router.patch('/:contactId/read', MessageController.markAsRead);

export default router;

const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');

router.post('/messages', auth, messageController.saveMessage);
router.get('/messages', auth, messageController.getMessages);
router.post('/messages/read', auth, messageController.markAsRead);
router.delete('/messages/clear', auth, messageController.clearMessages);
router.delete('/messages/delete-user-messages', auth, messageController.deleteUserMessages);
router.delete('/messages/delete-selected', auth, messageController.deleteSelectedMessages);
router.get('/conversations/:userId', auth, messageController.getConversations);

module.exports = router; 
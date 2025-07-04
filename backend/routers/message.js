const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

router.post('/messages', authMiddleware, messageController.saveMessage);
router.get('/messages', authMiddleware, messageController.getMessages);
router.post('/messages/read', authMiddleware, messageController.markAsRead);

module.exports = router; 
import express from 'express';
import { Message } from '../models/message.model';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get chat history with a specific user
router.get('/messages/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const currentUserId = req.user.userId;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
    })
    .sort({ createdAt: 1 })
    .populate('sender', 'name')
    .populate('receiver', 'name');

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Update message status
router.put('/messages/:messageId/status', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const message = await Message.findByIdAndUpdate(
      messageId,
      { status },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    res.json(message);
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({ message: 'Error updating message status' });
  }
});

export default router; 
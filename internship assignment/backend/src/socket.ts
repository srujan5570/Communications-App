import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Message } from './models/message.model';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const setupSocket = (server: HttpServer) => {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Store user socket mappings
  const userSockets = new Map<string, string>();

  io.use((socket, next) => {
    // Try to get token from different possible locations
    const authToken = socket.handshake.auth.token ||
                     socket.handshake.headers.authorization?.replace('Bearer ', '') ||
                     socket.handshake.query?.token;

    console.log('Socket authentication attempt with token:', authToken ? 'Present' : 'Missing');
    console.log('Auth sources:', {
      authToken: !!socket.handshake.auth.token,
      headers: !!socket.handshake.headers.authorization,
      query: !!socket.handshake.query?.token
    });
    
    if (!authToken) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(authToken, JWT_SECRET) as { userId: string };
      socket.data.userId = decoded.userId;
      console.log('Socket authenticated for user:', decoded.userId);
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    userSockets.set(userId, socket.id);

    console.log(`User connected: ${userId} with socket ID: ${socket.id}`);
    console.log('Current connected users:', Array.from(userSockets.keys()));

    // Handle call signaling
    socket.on('call_request', (data: { targetUserId: string; mode: 'voice' | 'video' }) => {
      const targetSocketId = userSockets.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('incoming_call', {
          callerId: userId,
          mode: data.mode,
        });
      }
    });

    socket.on('call_accepted', (data: { targetUserId: string }) => {
      const targetSocketId = userSockets.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call_accepted', { accepterId: userId });
      }
    });

    socket.on('call_rejected', (data: { targetUserId: string }) => {
      const targetSocketId = userSockets.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call_rejected', { rejecterId: userId });
      }
    });

    socket.on('call_ended', (data: { targetUserId: string }) => {
      const targetSocketId = userSockets.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call_ended', { enderId: userId });
      }
    });

    // WebRTC Signaling
    socket.on('webrtc_offer', (data: { targetUserId: string; offer: any }) => {
      const targetSocketId = userSockets.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc_offer', {
          callerId: userId,
          offer: data.offer,
        });
      }
    });

    socket.on('webrtc_answer', (data: { targetUserId: string; answer: any }) => {
      const targetSocketId = userSockets.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc_answer', {
          answererId: userId,
          answer: data.answer,
        });
      }
    });

    socket.on('webrtc_ice_candidate', (data: { targetUserId: string; candidate: any }) => {
      const targetSocketId = userSockets.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc_ice_candidate', {
          senderId: userId,
          candidate: data.candidate,
        });
      }
    });

    // Handle private messages
    socket.on('private_message', async (data: { receiverId: string; content: string }) => {
      console.log('Received private message:', {
        from: userId,
        to: data.receiverId,
        content: data.content
      });

      try {
        const message = new Message({
          sender: userId,
          receiver: data.receiverId,
          content: data.content,
          status: 'sent',
        });

        console.log('Attempting to save message to MongoDB:', message);
        await message.save();
        console.log('Message saved successfully with ID:', message._id);

        // Send to receiver if online
        const receiverSocketId = userSockets.get(data.receiverId);
        console.log('Receiver socket ID:', receiverSocketId || 'Not connected');
        
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('new_message', {
            ...message.toJSON(),
            sender: { _id: userId },
          });
          console.log('Message emitted to receiver');

          // Update status to delivered
          message.status = 'delivered';
          await message.save();
          console.log('Message status updated to delivered');
        }

        // Send confirmation to sender
        socket.emit('message_sent', message);
        console.log('Message confirmation sent to sender');
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('message_error', { 
          error: 'Failed to send message',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Handle read receipts
    socket.on('mark_read', async (data: { messageId: string }) => {
      console.log('Marking message as read:', data.messageId);
      
      try {
        const message = await Message.findByIdAndUpdate(
          data.messageId,
          { status: 'read' },
          { new: true }
        );

        if (message) {
          console.log('Message updated to read status:', message._id);
          const senderSocketId = userSockets.get(message.sender.toString());
          
          if (senderSocketId) {
            io.to(senderSocketId).emit('message_status', {
              messageId: message._id,
              status: 'read',
            });
            console.log('Read receipt sent to sender');
          }
        } else {
          console.log('Message not found for marking as read:', data.messageId);
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      userSockets.delete(userId);
      console.log(`User disconnected: ${userId}`);
      console.log('Remaining connected users:', Array.from(userSockets.keys()));
    });
  });

  return io;
}; 
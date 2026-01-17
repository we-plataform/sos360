import type { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt.js';
import { logger } from '../lib/logger.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  workspaceId?: string;
}

export function setupSocket(io: Server): void {
  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.userId = payload.sub;
      socket.workspaceId = payload.workspaceId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info({ userId: socket.userId }, 'Client connected');

    // Join workspace room
    if (socket.workspaceId) {
      socket.join(`workspace:${socket.workspaceId}`);
    }

    // Join conversation room
    socket.on('join:conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      logger.debug({ conversationId }, 'Joined conversation room');
    });

    // Leave conversation room
    socket.on('leave:conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      logger.debug({ conversationId }, 'Left conversation room');
    });

    // Typing indicator
    socket.on('typing:start', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        userId: socket.userId,
        conversationId,
      });
    });

    socket.on('typing:stop', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        userId: socket.userId,
        conversationId,
      });
    });

    socket.on('disconnect', () => {
      logger.info({ userId: socket.userId }, 'Client disconnected');
    });
  });
}

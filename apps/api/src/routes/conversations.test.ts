import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { conversationsRouter } from './conversations.js';

// Mock dependencies (already mocked in setup.ts, just importing here to use)
const { prisma } = await import('@lia360/database');
const { errorHandler } = await import('../middleware/error-handler.js');

vi.mock('../middleware/auth.js', () => ({
  authenticate: (_req: any, _res: any, next: any) => {
    _req.user = {
      id: 'user-123',
      workspaceId: 'workspace-123',
      workspaceRole: 'admin',
    };
    next();
  },
  authorize: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/validate.js', () => ({
  validate: (_schema: any, _type: string) => (_req: any, _res: any, next: any) => next(),
}));

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1/conversations', conversationsRouter);
app.use(errorHandler); // Add error handler to properly format error responses

describe('Conversations API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /conversations', () => {
    it('should return paginated list of conversations', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          platform: 'linkedin',
          status: 'active',
          unreadCount: 2,
          lastMessageAt: new Date('2024-01-15T10:00:00Z'),
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-15T10:00:00Z'),
          lead: {
            id: 'lead-1',
            username: 'john.doe',
            fullName: 'John Doe',
            avatarUrl: 'https://example.com/avatar.jpg',
            platform: 'linkedin',
            profileUrl: 'https://linkedin.com/in/johndoe',
          },
          assignedTo: null,
          messages: [{
            id: 'msg-1',
            content: 'Hello!',
            sentAt: new Date('2024-01-15T10:00:00Z'),
          }],
        },
      ];

      vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce(mockConversations as any);
      vi.mocked(prisma.conversation.count).mockResolvedValueOnce(1);

      const response = await request(app)
        .get('/api/v1/conversations')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].platform).toBe('linkedin');
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(1);
    });

    it('should filter conversations by status', async () => {
      vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.conversation.count).mockResolvedValueOnce(0);

      await request(app)
        .get('/api/v1/conversations?status=active')
        .expect(200);

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active',
          }),
        })
      );
    });

    it('should filter conversations by unread', async () => {
      vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.conversation.count).mockResolvedValueOnce(0);

      await request(app)
        .get('/api/v1/conversations?unread=true')
        .expect(200);

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            unreadCount: { gt: 0 },
          }),
        })
      );
    });

    it('should filter conversations by platform', async () => {
      vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.conversation.count).mockResolvedValueOnce(0);

      await request(app)
        .get('/api/v1/conversations?platform=linkedin')
        .expect(200);

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            platform: 'linkedin',
          }),
        })
      );
    });

    it('should filter conversations by assigned user', async () => {
      vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.conversation.count).mockResolvedValueOnce(0);

      await request(app)
        .get('/api/v1/conversations?assignedTo=user-456')
        .expect(200);

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedToId: 'user-456',
          }),
        })
      );
    });

    it.skip('should only show assigned conversations for agents', async () => {
      // Override mock for agent role
      const authMock = await import('../middleware/auth.js');
      vi.spyOn(authMock, 'authenticate').mockImplementation((_req: any, _res: any, next: any) => {
        _req.user = {
          id: 'user-123',
          workspaceId: 'workspace-123',
          workspaceRole: 'agent',
        };
        next();
      });

      vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.conversation.count).mockResolvedValueOnce(0);

      await request(app)
        .get('/api/v1/conversations')
        .expect(200);

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedToId: 'user-123',
          }),
        })
      );
    });
  });

  describe('GET /conversations/:id', () => {
    it('should return conversation with messages', async () => {
      const mockConversation = {
        id: 'conv-1',
        platform: 'linkedin',
        status: 'active',
        unreadCount: 2,
        lastMessageAt: new Date('2024-01-15T10:00:00Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
        lead: {
          id: 'lead-1',
          username: 'john.doe',
          fullName: 'John Doe',
          avatarUrl: 'https://example.com/avatar.jpg',
          platform: 'linkedin',
          profileUrl: 'https://linkedin.com/in/johndoe',
        },
        assignedTo: {
          id: 'user-123',
          fullName: 'Agent Smith',
          avatarUrl: 'https://example.com/agent.jpg',
        },
        messages: [
          {
            id: 'msg-1',
            content: 'Hello!',
            sentAt: new Date('2024-01-15T10:00:00Z'),
          },
          {
            id: 'msg-2',
            content: 'How are you?',
            sentAt: new Date('2024-01-15T09:00:00Z'),
          },
        ],
      };

      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(mockConversation as any);

      const response = await request(app)
        .get('/api/v1/conversations/conv-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('conv-1');
      expect(response.body.data.messages).toHaveLength(2);
      expect(response.body.data.hasMoreMessages).toBe(false);
    });

    it('should return 404 when conversation not found', async () => {
      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/conversations/conv-999')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should limit messages with messagesLimit query param', async () => {
      const mockConversation = {
        id: 'conv-1',
        platform: 'linkedin',
        status: 'active',
        unreadCount: 0,
        messages: Array(50).fill({ id: 'msg', content: 'test', sentAt: new Date() }),
      };

      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(mockConversation as any);

      await request(app)
        .get('/api/v1/conversations/conv-1?messagesLimit=20')
        .expect(200);

      expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            messages: expect.objectContaining({
              take: 20,
            }),
          }),
        })
      );
    });

    it.skip('should return 404 for agent accessing unassigned conversation', async () => {
      const authMock = await import('../middleware/auth.js');
      vi.spyOn(authMock, 'authenticate').mockImplementation((_req: any, _res: any, next: any) => {
        _req.user = {
          id: 'user-999',
          workspaceId: 'workspace-123',
          workspaceRole: 'agent',
        };
        next();
      });

      const mockConversation = {
        id: 'conv-1',
        platform: 'linkedin',
        status: 'active',
        assignedToId: 'user-123', // Different from agent
        lead: { id: 'lead-1' },
        messages: [],
      };

      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(mockConversation as any);

      const response = await request(app)
        .get('/api/v1/conversations/conv-1')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /conversations/:id/messages', () => {
    it('should send a message', async () => {
      const mockConversation = {
        id: 'conv-1',
        leadId: 'lead-1',
      };

      const mockMessage = {
        id: 'msg-1',
        conversationId: 'conv-1',
        content: 'Hello, this is a test message',
        messageType: 'text',
        senderType: 'agent',
        senderId: 'user-123',
        status: 'pending',
        sentAt: new Date(),
      };

      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(mockConversation as any);
      vi.mocked(prisma.message.create).mockResolvedValueOnce(mockMessage as any);
      vi.mocked(prisma.conversation.update).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.activity.create).mockResolvedValueOnce({} as any);

      // Mock socket.io
      const mockIo = {
        to: vi.fn().mockReturnThis(),
        emit: vi.fn(),
      };
      app.set('io', mockIo);

      const response = await request(app)
        .post('/api/v1/conversations/conv-1/messages')
        .send({
          content: 'Hello, this is a test message',
          messageType: 'text',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('Hello, this is a test message');
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: 'Hello, this is a test message',
            senderType: 'agent',
            senderId: 'user-123',
          }),
        })
      );
      expect(mockIo.to).toHaveBeenCalledWith('workspace:workspace-123');
      expect(mockIo.emit).toHaveBeenCalledWith('message:created', expect.objectContaining({
        conversationId: 'conv-1',
      }));
    });

    it('should default messageType to text', async () => {
      const mockConversation = {
        id: 'conv-1',
        leadId: 'lead-1',
      };

      const mockMessage = {
        id: 'msg-1',
        conversationId: 'conv-1',
        content: 'Test',
        messageType: 'text',
        senderType: 'agent',
        status: 'pending',
      };

      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(mockConversation as any);
      vi.mocked(prisma.message.create).mockResolvedValueOnce(mockMessage as any);
      vi.mocked(prisma.conversation.update).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.activity.create).mockResolvedValueOnce({} as any);

      const mockIo = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
      app.set('io', mockIo);

      await request(app)
        .post('/api/v1/conversations/conv-1/messages')
        .send({ content: 'Test' })
        .expect(201);

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            messageType: 'text',
          }),
        })
      );
    });

    it('should return 404 when conversation not found', async () => {
      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/conversations/conv-999/messages')
        .send({
          content: 'Test message',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should create activity log when message sent', async () => {
      const mockConversation = {
        id: 'conv-1',
        leadId: 'lead-1',
      };

      const mockMessage = {
        id: 'msg-1',
        conversationId: 'conv-1',
        content: 'Test',
        messageType: 'text',
        senderType: 'agent',
        status: 'pending',
      };

      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(mockConversation as any);
      vi.mocked(prisma.message.create).mockResolvedValueOnce(mockMessage as any);
      vi.mocked(prisma.conversation.update).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.activity.create).mockResolvedValueOnce({} as any);

      const mockIo = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
      app.set('io', mockIo);

      await request(app)
        .post('/api/v1/conversations/conv-1/messages')
        .send({ content: 'Test' });

      expect(prisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'message_sent',
            leadId: 'lead-1',
            userId: 'user-123',
          }),
        })
      );
    });
  });

  describe('POST /conversations/:id/read', () => {
    it('should mark conversation as read', async () => {
      const mockConversation = {
        id: 'conv-1',
        unreadCount: 5,
      };

      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(mockConversation as any);
      vi.mocked(prisma.conversation.update).mockResolvedValueOnce({ id: 'conv-1', unreadCount: 0 } as any);
      vi.mocked(prisma.message.updateMany).mockResolvedValueOnce({ count: 5 } as any);

      const response = await request(app)
        .post('/api/v1/conversations/conv-1/read')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.unreadCount).toBe(0);
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-1' },
          data: { unreadCount: 0 },
        })
      );
    });

    it('should mark all lead messages as read', async () => {
      const mockConversation = {
        id: 'conv-1',
        unreadCount: 3,
      };

      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(mockConversation as any);
      vi.mocked(prisma.conversation.update).mockResolvedValueOnce({ id: 'conv-1', unreadCount: 0 } as any);
      vi.mocked(prisma.message.updateMany).mockResolvedValueOnce({ count: 3 } as any);

      await request(app)
        .post('/api/v1/conversations/conv-1/read')
        .expect(200);

      expect(prisma.message.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            conversationId: 'conv-1',
            senderType: 'lead',
            readAt: null,
          },
          data: { readAt: expect.any(Date) },
        })
      );
    });

    it('should return 404 when conversation not found', async () => {
      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/conversations/conv-999/read')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /conversations/:id/assign', () => {
    it('should assign conversation to user', async () => {
      const mockConversation = {
        id: 'conv-1',
        leadId: 'lead-1',
      };

      const mockUpdatedConversation = {
        id: 'conv-1',
        platform: 'linkedin',
        status: 'active',
        assignedToId: 'user-456',
        assignedTo: {
          id: 'user-456',
          fullName: 'Jane Smith',
          avatarUrl: 'https://example.com/jane.jpg',
        },
      };

      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(mockConversation as any);
      vi.mocked(prisma.conversation.update).mockResolvedValueOnce(mockUpdatedConversation as any);

      const response = await request(app)
        .post('/api/v1/conversations/conv-1/assign')
        .send({
          userId: 'user-456',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assignedToId).toBe('user-456');
      expect(response.body.data.assignedTo.fullName).toBe('Jane Smith');
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-1' },
          data: { assignedToId: 'user-456' },
        })
      );
    });

    it('should return 404 when conversation not found', async () => {
      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/conversations/conv-999/assign')
        .send({ userId: 'user-456' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /conversations/:id/archive', () => {
    it('should archive conversation', async () => {
      const mockConversation = {
        id: 'conv-1',
        status: 'active',
      };

      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(mockConversation as any);
      vi.mocked(prisma.conversation.update).mockResolvedValueOnce({
        id: 'conv-1',
        status: 'archived',
      } as any);

      const response = await request(app)
        .post('/api/v1/conversations/conv-1/archive')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('archived');
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-1' },
          data: { status: 'archived' },
        })
      );
    });

    it('should return 404 when conversation not found', async () => {
      vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/conversations/conv-999/archive')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});

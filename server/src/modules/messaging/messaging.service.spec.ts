import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

const mockPrisma: any = {
  conversationMember: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  conversation: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  message: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  messageRequest: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userBlock: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  report: {
    create: jest.fn(),
  },
};

const mockRedis = {
  checkRateLimit: jest.fn(),
};

function makeConversation(overrides: Record<string, any> = {}) {
  return {
    id: 'conv-1',
    members: [
      {
        userId: 'user-1',
        lastReadAt: null,
        user: {
          id: 'user-1',
          email: 'user1@example.com',
          role: 'LEARNER',
          profile: { displayName: 'User One', profileTags: [] },
        },
      },
      {
        userId: 'user-2',
        lastReadAt: null,
        user: {
          id: 'user-2',
          email: 'user2@example.com',
          role: 'EXPERT',
          profile: { displayName: 'User Two', profileTags: [] },
        },
      },
    ],
    messages: [],
    ...overrides,
  };
}

describe('MessagingService', () => {
  let service: MessagingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.checkRateLimit.mockResolvedValue(true);
    mockPrisma.userBlock.findFirst.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get(MessagingService);
  });

  describe('getOrCreateConversation', () => {
    it('rejects attempts to create a conversation with yourself', async () => {
      await expect(
        service.getOrCreateConversation('user-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns an existing conversation when one already exists', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation());
      mockPrisma.message.count.mockResolvedValue(0);

      const result = await service.getOrCreateConversation('user-1', 'user-2');

      expect(result.id).toBe('conv-1');
      expect(mockPrisma.conversation.create).not.toHaveBeenCalled();
    });

    it('creates a new conversation when none exists', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue(null);
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv-new' });
      mockPrisma.conversation.findUnique.mockResolvedValue(
        makeConversation({ id: 'conv-new' }),
      );
      mockPrisma.message.count.mockResolvedValue(0);

      const result = await service.getOrCreateConversation('user-1', 'user-2');

      expect(result.id).toBe('conv-new');
      expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
        data: {
          type: 'dm',
          members: {
            createMany: {
              data: [{ userId: 'user-1' }, { userId: 'user-2' }],
            },
          },
        },
      });
    });
  });

  describe('sendMessage', () => {
    it('rejects when the rate limit is exceeded', async () => {
      mockRedis.checkRateLimit.mockResolvedValue(false);

      await expect(
        service.sendMessage('conv-1', 'user-1', 'hello'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns the existing message when the client message id is reused', async () => {
      mockPrisma.conversationMember.findUnique.mockResolvedValue({
        conversationId: 'conv-1',
        userId: 'user-1',
      });
      mockPrisma.conversationMember.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);
      mockPrisma.message.findFirst.mockResolvedValue({
        id: 'msg-1',
        senderId: 'user-1',
        bodyText: 'hello',
        createdAt: new Date('2026-03-13T00:00:00Z'),
      });

      const result = await service.sendMessage(
        'conv-1',
        'user-1',
        'hello',
        'client-1',
      );

      expect(result.id).toBe('msg-1');
      expect(mockPrisma.message.create).not.toHaveBeenCalled();
      expect(mockPrisma.conversation.update).not.toHaveBeenCalled();
    });

    it('creates a new message and updates the conversation metadata', async () => {
      mockPrisma.conversationMember.findUnique.mockResolvedValue({
        conversationId: 'conv-1',
        userId: 'user-1',
      });
      mockPrisma.conversationMember.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);
      mockPrisma.message.findFirst.mockResolvedValue(null);
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-2',
        senderId: 'user-1',
        bodyText: 'new message',
        createdAt: new Date('2026-03-13T01:00:00Z'),
      });
      mockPrisma.conversation.update.mockResolvedValue({});

      const result = await service.sendMessage(
        'conv-1',
        'user-1',
        'new message',
        'client-2',
      );

      expect(result.id).toBe('msg-2');
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-1',
          senderId: 'user-1',
          bodyText: 'new message',
          clientMsgId: 'client-2',
        },
      });
      expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: {
          lastMessageAt: expect.any(Date),
          lastMessageId: 'msg-2',
        },
      });
    });
  });

  describe('createRequest', () => {
    it('returns an existing pending request instead of creating another one', async () => {
      mockPrisma.messageRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
      });

      const result = await service.createRequest('user-1', 'user-2');

      expect(result).toEqual({ id: 'req-1', status: 'pending' });
      expect(mockPrisma.messageRequest.create).not.toHaveBeenCalled();
    });

    it('rejects requests that were already processed', async () => {
      mockPrisma.messageRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'accepted',
      });

      await expect(service.createRequest('user-1', 'user-2')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates a new request when none exists', async () => {
      mockPrisma.messageRequest.findUnique.mockResolvedValue(null);
      mockPrisma.messageRequest.create.mockResolvedValue({ id: 'req-2' });

      const result = await service.createRequest('user-1', 'user-2');

      expect(result).toEqual({ id: 'req-2' });
      expect(mockPrisma.messageRequest.create).toHaveBeenCalledWith({
        data: { fromUserId: 'user-1', toUserId: 'user-2' },
      });
    });
  });

  describe('acceptRequest', () => {
    it('throws when the request does not exist', async () => {
      mockPrisma.messageRequest.findUnique.mockResolvedValue(null);

      await expect(service.acceptRequest('req-1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when a different user tries to accept the request', async () => {
      mockPrisma.messageRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        status: 'pending',
      });

      await expect(service.acceptRequest('req-1', 'user-3')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('marks the request accepted after creating a conversation', async () => {
      mockPrisma.messageRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        status: 'pending',
      });
      mockPrisma.conversation.findFirst.mockResolvedValue(null);
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv-new' });
      mockPrisma.conversation.findUnique.mockResolvedValue(
        makeConversation({ id: 'conv-new' }),
      );
      mockPrisma.message.count.mockResolvedValue(0);
      mockPrisma.messageRequest.update.mockResolvedValue({
        id: 'req-1',
        status: 'accepted',
        conversationId: 'conv-new',
      });

      const result = await service.acceptRequest('req-1', 'user-2');

      expect(result).toEqual({
        id: 'req-1',
        status: 'accepted',
        conversationId: 'conv-new',
      });
    });
  });

  describe('blockUser / unblockUser / report', () => {
    it('creates a block relationship', async () => {
      mockPrisma.userBlock.upsert.mockResolvedValue({ blockerId: 'user-1', blockedId: 'user-2' });

      const result = await service.blockUser('user-1', 'user-2');

      expect(result).toEqual({ blockerId: 'user-1', blockedId: 'user-2' });
      expect(mockPrisma.userBlock.upsert).toHaveBeenCalledWith({
        where: { blockerId_blockedId: { blockerId: 'user-1', blockedId: 'user-2' } },
        update: {},
        create: { blockerId: 'user-1', blockedId: 'user-2' },
      });
    });

    it('rejects blocking yourself', async () => {
      await expect(service.blockUser('user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('removes a block relationship', async () => {
      mockPrisma.userBlock.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.unblockUser('user-1', 'user-2');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.userBlock.deleteMany).toHaveBeenCalledWith({
        where: { blockerId: 'user-1', blockedId: 'user-2' },
      });
    });

    it('creates a report record', async () => {
      mockPrisma.report.create.mockResolvedValue({ id: 'report-1' });

      const result = await service.report('user-1', 'user', 'user-2', 'spam');

      expect(result).toEqual({ id: 'report-1' });
      expect(mockPrisma.report.create).toHaveBeenCalledWith({
        data: {
          reporterId: 'user-1',
          targetType: 'user',
          targetId: 'user-2',
          reason: 'spam',
        },
      });
    });
  });
});

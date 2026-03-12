import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { serializeUser, serializeMessage } from '../../common/serializers/serialize';

@Injectable()
export class MessagingService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ---- Conversations ----

  async getConversations(userId: string) {
    const members = await this.prisma.conversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                user: {
                  include: {
                    profile: {
                      include: { profileTags: { include: { tag: true } } },
                    },
                  },
                },
              },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
      orderBy: { conversation: { lastMessageAt: 'desc' } },
    });

    const results = await Promise.all(
      members.map(async (m) => {
        const conv = m.conversation;
        const lastMsg = conv.messages[0] || null;

        // Serialize participants as User[]
        const participants = conv.members.map((cm) => serializeUser(cm.user));

        // Find peer for receiverId
        const peer = conv.members.find((cm) => cm.userId !== userId);

        // Compute unread count based on lastReadAt
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            ...(m.lastReadAt
              ? { createdAt: { gt: m.lastReadAt } }
              : {}),
          },
        });

        return {
          id: conv.id,
          participants,
          lastMessage: lastMsg
            ? serializeMessage(lastMsg, peer?.userId)
            : undefined,
          unreadCount,
          status: 'ACCEPTED' as const,
          initiatorId: userId,
        };
      }),
    );

    return results;
  }

  async getOrCreateConversation(userId: string, peerUserId: string) {
    if (userId === peerUserId) {
      throw new BadRequestException('Cannot create conversation with yourself');
    }

    // Check blocks
    await this.checkBlocked(userId, peerUserId);

    // Find existing DM conversation
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'dm',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: peerUserId } } },
        ],
      },
    });

    if (existing) {
      return this.serializeConversation(existing.id, userId);
    }

    // Create new conversation
    const conv = await this.prisma.conversation.create({
      data: {
        type: 'dm',
        members: {
          createMany: {
            data: [{ userId }, { userId: peerUserId }],
          },
        },
      },
    });

    return this.serializeConversation(conv.id, userId);
  }

  /** Serialize a conversation to frontend ChatThread shape */
  private async serializeConversation(convId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: convId },
      include: {
        members: {
          include: {
            user: {
              include: {
                profile: {
                  include: { profileTags: { include: { tag: true } } },
                },
              },
            },
          },
        },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const participants = conv.members.map((cm) => serializeUser(cm.user));
    const peer = conv.members.find((cm) => cm.userId !== userId);
    const lastMsg = conv.messages[0] || null;
    const myMembership = conv.members.find((cm) => cm.userId === userId);

    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: convId,
        senderId: { not: userId },
        ...(myMembership?.lastReadAt
          ? { createdAt: { gt: myMembership.lastReadAt } }
          : {}),
      },
    });

    return {
      id: conv.id,
      participants,
      lastMessage: lastMsg ? serializeMessage(lastMsg, peer?.userId) : undefined,
      unreadCount,
      status: 'ACCEPTED',
      initiatorId: userId,
    };
  }

  async getMessages(conversationId: string, userId: string, cursor?: string, limit = 50) {
    // Verify membership
    await this.verifyMembership(conversationId, userId);

    const where: any = { conversationId };
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    // Get all members to find receiver
    const convMembers = await this.prisma.conversationMember.findMany({
      where: { conversationId },
    });

    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.map((msg) => {
      const receiverId = convMembers.find((m) => m.userId !== msg.senderId)?.userId ?? '';
      return serializeMessage(msg, receiverId);
    });
  }

  async sendMessage(conversationId: string, userId: string, bodyText: string, clientMsgId?: string) {
    // Rate limiting: 60 msgs/min
    const allowed = await this.redis.checkRateLimit(
      `ratelimit:msg:${userId}`,
      60,
      60,
    );
    if (!allowed) throw new BadRequestException('Message rate limit exceeded');

    await this.verifyMembership(conversationId, userId);

    // Check blocks between participants
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
    });
    for (const m of members) {
      if (m.userId !== userId) {
        await this.checkBlocked(userId, m.userId);
      }
    }

    // Idempotency check
    if (clientMsgId) {
      const existing = await this.prisma.message.findFirst({
        where: { senderId: userId, clientMsgId },
      });
      if (existing) {
        const peer = members.find((m) => m.userId !== userId);
        return serializeMessage(existing, peer?.userId);
      }
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        bodyText,
        clientMsgId,
      },
    });

    // Update conversation
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: message.createdAt,
        lastMessageId: message.id,
      },
    });

    // Find peer receiver
    const peer = members.find((m) => m.userId !== userId);
    return serializeMessage(message, peer?.userId);
  }

  async markRead(conversationId: string, userId: string) {
    const lastMsg = await this.prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastMsg) return;

    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: {
        lastReadMessageId: lastMsg.id,
        lastReadAt: new Date(),
      },
    });
  }

  // ---- Message Requests ----

  async createRequest(fromUserId: string, toUserId: string) {
    await this.checkBlocked(fromUserId, toUserId);

    const existing = await this.prisma.messageRequest.findUnique({
      where: { fromUserId_toUserId: { fromUserId, toUserId } },
    });

    if (existing) {
      if (existing.status === 'pending') return existing;
      throw new BadRequestException('Request already processed');
    }

    return this.prisma.messageRequest.create({
      data: { fromUserId, toUserId },
    });
  }

  async getMyRequests(userId: string) {
    const requests = await this.prisma.messageRequest.findMany({
      where: {
        status: 'pending',
        OR: [
          { toUserId: userId },
          { fromUserId: userId },
        ],
      },
      include: {
        fromUser: {
          include: {
            profile: {
              include: { profileTags: { include: { tag: true } } },
            },
          },
        },
        toUser: {
          include: {
            profile: {
              include: { profileTags: { include: { tag: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((req) => ({
      id: req.id,
      participants: [serializeUser(req.fromUser), serializeUser(req.toUser)],
      unreadCount: 0,
      status: 'PENDING',
      initiatorId: req.fromUserId,
    }));
  }

  async acceptRequest(requestId: string, userId: string) {
    const request = await this.prisma.messageRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException();
    if (request.toUserId !== userId) throw new ForbiddenException();
    if (request.status !== 'pending') throw new BadRequestException('Request already processed');

    // Create conversation
    const conversation = await this.getOrCreateConversation(request.fromUserId, request.toUserId);

    return this.prisma.messageRequest.update({
      where: { id: requestId },
      data: { status: 'accepted', conversationId: conversation.id },
    });
  }

  async rejectRequest(requestId: string, userId: string) {
    const request = await this.prisma.messageRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException();
    if (request.toUserId !== userId) throw new ForbiddenException();

    return this.prisma.messageRequest.update({
      where: { id: requestId },
      data: { status: 'rejected' },
    });
  }

  // ---- Safety (Block/Report) ----

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) throw new BadRequestException('Cannot block yourself');

    return this.prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.userBlock.deleteMany({
      where: { blockerId, blockedId },
    });
    return { success: true };
  }

  async report(reporterId: string, targetType: string, targetId: string, reason: string) {
    return this.prisma.report.create({
      data: { reporterId, targetType, targetId, reason },
    });
  }

  // ---- Helpers ----

  private async verifyMembership(conversationId: string, userId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new ForbiddenException('You are not a member of this conversation');
  }

  private async checkBlocked(userA: string, userB: string) {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userA, blockedId: userB },
          { blockerId: userB, blockedId: userA },
        ],
      },
    });

    if (block) {
      throw new ForbiddenException('Communication blocked between these users');
    }
  }
}

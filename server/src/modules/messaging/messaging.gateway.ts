import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MessagingService } from './messaging.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);

  constructor(
    private messagingService: MessagingService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Authenticate via session cookie
      const session = (client.request as any).session;
      if (!session?.userId) {
        this.logger.warn(`Unauthenticated WS connection rejected: ${client.id}`);
        client.disconnect();
        return;
      }

      const userId = session.userId;
      client.data.userId = userId;

      // Join all user's conversation rooms
      const memberships = await this.prisma.conversationMember.findMany({
        where: { userId },
        select: { conversationId: true },
      });

      for (const m of memberships) {
        client.join(`conversation:${m.conversationId}`);
      }

      this.logger.log(`User ${userId} connected via WS (${client.id}), joined ${memberships.length} rooms`);
    } catch (err) {
      this.logger.error('WS connection error', err);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS disconnected: ${client.id} (user: ${client.data.userId})`);
  }

  private async ensureConversationMembership(
    client: Socket,
    conversationId: string,
  ): Promise<string | null> {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('typing:error', {
        conversationId,
        error: 'Unauthenticated WebSocket client',
      });
      return null;
    }

    const membership = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      select: { conversationId: true },
    });

    if (!membership) {
      this.logger.warn(
        `Rejected typing event from non-member user ${userId} for conversation ${conversationId}`,
      );
      client.emit('typing:error', {
        conversationId,
        error: 'You are not a member of this conversation',
      });
      return null;
    }

    return userId;
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; bodyText: string; clientMsgId?: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    try {
      const message = await this.messagingService.sendMessage(
        data.conversationId,
        userId,
        data.bodyText,
        data.clientMsgId,
      );

      // Ack to sender
      client.emit('message:ack', {
        clientMsgId: data.clientMsgId,
        message,
      });

      // Broadcast to conversation members (except sender)
      client.to(`conversation:${data.conversationId}`).emit('message:new', {
        conversationId: data.conversationId,
        ...message,
      });

      // Update conversation for all members
      this.server.to(`conversation:${data.conversationId}`).emit('conversation:update', {
        conversationId: data.conversationId,
        lastMessage: message,
      });
    } catch (err) {
      client.emit('message:error', {
        clientMsgId: data.clientMsgId,
        error: err.message,
      });
    }
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = await this.ensureConversationMembership(client, data.conversationId);
    if (!userId) return;

    client.to(`conversation:${data.conversationId}`).emit('typing:start', {
      userId,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = await this.ensureConversationMembership(client, data.conversationId);
    if (!userId) return;

    client.to(`conversation:${data.conversationId}`).emit('typing:stop', {
      userId,
      conversationId: data.conversationId,
    });
  }
}

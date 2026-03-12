import { MessagingGateway } from './messaging.gateway';
import { MessagingService } from './messaging.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('MessagingGateway', () => {
  const mockMessagingService = {} as MessagingService;
  const mockPrisma = {
    conversationMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const createSocket = () => {
    const roomEmitter = { emit: jest.fn() };
    return {
      id: 'socket-1',
      data: { userId: 'user-1' },
      request: { session: { userId: 'user-1' } },
      join: jest.fn(),
      to: jest.fn(() => roomEmitter),
      emit: jest.fn(),
      disconnect: jest.fn(),
    } as any;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('broadcasts typing events for conversation members', async () => {
    const gateway = new MessagingGateway(mockMessagingService, mockPrisma);
    const client = createSocket();

    (mockPrisma.conversationMember.findUnique as jest.Mock).mockResolvedValue({
      conversationId: 'conv-1',
    });

    await gateway.handleTypingStart(client, { conversationId: 'conv-1' });

    expect(mockPrisma.conversationMember.findUnique).toHaveBeenCalledWith({
      where: {
        conversationId_userId: {
          conversationId: 'conv-1',
          userId: 'user-1',
        },
      },
      select: { conversationId: true },
    });
    expect(client.to).toHaveBeenCalledWith('conversation:conv-1');
    expect(client.to().emit).toHaveBeenCalledWith('typing:start', {
      userId: 'user-1',
      conversationId: 'conv-1',
    });
    expect(client.emit).not.toHaveBeenCalledWith(
      'typing:error',
      expect.anything(),
    );
  });

  it('rejects typing events from non-members', async () => {
    const gateway = new MessagingGateway(mockMessagingService, mockPrisma);
    const client = createSocket();

    (mockPrisma.conversationMember.findUnique as jest.Mock).mockResolvedValue(null);

    await gateway.handleTypingStop(client, { conversationId: 'conv-9' });

    expect(client.to).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('typing:error', {
      conversationId: 'conv-9',
      error: 'You are not a member of this conversation',
    });
  });
});

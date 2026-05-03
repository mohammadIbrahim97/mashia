import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { MessageType } from '@shared/enums';
import { Message } from './message.entity';
import { AuthSocket, MessagingGateway } from './messaging.gateway';
import { MessagingService } from './messaging.service';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const conversationId = '11111111-1111-4111-8111-111111111111';

interface RoomTrackingSocket extends AuthSocket {
  rooms: Set<string>;
  join: jest.Mock<Promise<void>, [string]>;
}

interface BroadcastMocks {
  to: jest.Mock<{ emit: jest.Mock }, [string]>;
  emit: jest.Mock;
}

const buildSocket = (
  overrides: Partial<AuthSocket['handshake']> = {},
): AuthSocket => {
  const handshake = {
    auth: {} as Record<string, unknown>,
    headers: {} as Record<string, string>,
    ...overrides,
  };
  const rooms = new Set<string>();
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  return {
    id: 'sock-1',
    handshake,
    data: {},
    rooms,
    disconnect: jest.fn(),
    join: jest.fn(async (room: string) => {
      rooms.add(room);
    }),
    emit,
    to,
  } as unknown as RoomTrackingSocket;
};

describe('MessagingGateway', () => {
  let gateway: MessagingGateway;
  let jwtService: jest.Mocked<Pick<JwtService, 'verify'>>;
  let messagingService: jest.Mocked<
    Pick<MessagingService, 'assertIsParticipant' | 'sendMessage'>
  >;

  beforeEach(async () => {
    jwtService = { verify: jest.fn() };
    messagingService = {
      assertIsParticipant: jest.fn(),
      sendMessage: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagingGateway,
        { provide: MessagingService, useValue: messagingService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();
    gateway = moduleRef.get(MessagingGateway);
  });

  describe('handleConnection', () => {
    it('verifies token from handshake.auth.token and sets client.data.userId', () => {
      const client = buildSocket({ auth: { token: 'valid.jwt.token' } });
      jwtService.verify.mockReturnValue({ sub: userId } as never);

      gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith('valid.jwt.token', {
        secret: 'test-secret',
      });
      expect(client.data.userId).toBe(userId);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('falls back to Authorization Bearer header when handshake.auth has no token', () => {
      const client = buildSocket({
        auth: {},
        headers: { authorization: 'Bearer header.jwt.token' },
      });
      jwtService.verify.mockReturnValue({ sub: userId } as never);

      gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith('header.jwt.token', {
        secret: 'test-secret',
      });
      expect(client.data.userId).toBe(userId);
    });

    it('disconnects when no token is present', () => {
      const client = buildSocket({ auth: {}, headers: {} });

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(jwtService.verify).not.toHaveBeenCalled();
      expect(client.data.userId).toBeUndefined();
    });

    it('disconnects when token verification throws', () => {
      const client = buildSocket({ auth: { token: 'bad.jwt' } });
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.data.userId).toBeUndefined();
    });

    it('ignores Authorization header that is not a Bearer scheme', () => {
      const client = buildSocket({
        auth: {},
        headers: { authorization: 'Basic abc' },
      });

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleDisconnect', () => {
    it('does not throw and performs no DB writes', () => {
      const client = buildSocket();
      expect(() => gateway.handleDisconnect(client)).not.toThrow();
    });
  });

  describe('handleJoinConversation', () => {
    const buildAuthedSocket = (): RoomTrackingSocket => {
      const client = buildSocket() as RoomTrackingSocket;
      client.data.userId = userId;
      return client;
    };

    it('adds participant to conversation room and acks ok=true', async () => {
      const client = buildAuthedSocket();
      messagingService.assertIsParticipant.mockResolvedValue(undefined);

      const ack = await gateway.handleJoinConversation(client, {
        conversationId,
      });

      expect(messagingService.assertIsParticipant).toHaveBeenCalledWith(
        conversationId,
        userId,
      );
      expect(client.join).toHaveBeenCalledWith(`conversation:${conversationId}`);
      expect(client.rooms.has(`conversation:${conversationId}`)).toBe(true);
      expect(ack).toEqual({ ok: true });
    });

    it('acks forbidden and does not join room when caller is not a participant', async () => {
      const client = buildAuthedSocket();
      messagingService.assertIsParticipant.mockRejectedValue(
        new ForbiddenException(),
      );

      const ack = await gateway.handleJoinConversation(client, {
        conversationId,
      });

      expect(ack).toEqual({ ok: false, error: 'forbidden' });
      expect(client.join).not.toHaveBeenCalled();
      expect(client.rooms.has(`conversation:${conversationId}`)).toBe(false);
    });

    it('acks not_found when conversation does not exist', async () => {
      const client = buildAuthedSocket();
      messagingService.assertIsParticipant.mockRejectedValue(
        new NotFoundException(),
      );

      const ack = await gateway.handleJoinConversation(client, {
        conversationId,
      });

      expect(ack).toEqual({ ok: false, error: 'not_found' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('acks invalid_payload when conversationId is not a uuid v4', async () => {
      const client = buildAuthedSocket();

      const ack = await gateway.handleJoinConversation(client, {
        conversationId: 'not-a-uuid',
      });

      expect(ack).toEqual({ ok: false, error: 'invalid_payload' });
      expect(messagingService.assertIsParticipant).not.toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('acks invalid_payload when conversationId is missing', async () => {
      const client = buildAuthedSocket();

      const ack = await gateway.handleJoinConversation(client, {});

      expect(ack).toEqual({ ok: false, error: 'invalid_payload' });
      expect(messagingService.assertIsParticipant).not.toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('acks invalid_payload when payload is null', async () => {
      const client = buildAuthedSocket();

      const ack = await gateway.handleJoinConversation(client, null);

      expect(ack).toEqual({ ok: false, error: 'invalid_payload' });
      expect(messagingService.assertIsParticipant).not.toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('acks unauthorized when client.data.userId is missing', async () => {
      const client = buildSocket() as RoomTrackingSocket;

      const ack = await gateway.handleJoinConversation(client, {
        conversationId,
      });

      expect(ack).toEqual({ ok: false, error: 'unauthorized' });
      expect(messagingService.assertIsParticipant).not.toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('handleSendMessage', () => {
    const buildAuthedSocket = (): RoomTrackingSocket => {
      const client = buildSocket() as RoomTrackingSocket;
      client.data.userId = userId;
      return client;
    };

    const validPayload = {
      conversationId,
      content: 'hello',
      type: MessageType.TEXT,
    };

    const buildSavedMessage = (): Message =>
      ({
        id: 'msg-1',
        conversationId,
        senderId: userId,
        content: 'hello',
        type: MessageType.TEXT,
        createdAt: new Date('2026-05-03T12:00:00Z'),
        readAt: null,
      }) as Message;

    it('persists, broadcasts to other sockets in the room, and acks ok=true with the message', async () => {
      const client = buildAuthedSocket();
      const mocks = client as unknown as BroadcastMocks;
      const saved = buildSavedMessage();
      messagingService.sendMessage.mockResolvedValue(saved);

      const ack = await gateway.handleSendMessage(client, validPayload);

      expect(messagingService.sendMessage).toHaveBeenCalledWith(
        conversationId,
        userId,
        'hello',
        MessageType.TEXT,
      );
      expect(mocks.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
      expect(mocks.emit).toHaveBeenCalledWith('newMessage', saved);
      expect(ack).toEqual({ ok: true, message: saved });
    });

    it('acks forbidden and does not broadcast when caller is not a participant', async () => {
      const client = buildAuthedSocket();
      const mocks = client as unknown as BroadcastMocks;
      messagingService.sendMessage.mockRejectedValue(new ForbiddenException());

      const ack = await gateway.handleSendMessage(client, validPayload);

      expect(ack).toEqual({ ok: false, error: 'forbidden' });
      expect(mocks.to).not.toHaveBeenCalled();
    });

    it('acks not_found when conversation does not exist', async () => {
      const client = buildAuthedSocket();
      const mocks = client as unknown as BroadcastMocks;
      messagingService.sendMessage.mockRejectedValue(new NotFoundException());

      const ack = await gateway.handleSendMessage(client, validPayload);

      expect(ack).toEqual({ ok: false, error: 'not_found' });
      expect(mocks.to).not.toHaveBeenCalled();
    });

    it.each<[string, unknown]>([
      ['conversationId is not a uuid v4', { ...validPayload, conversationId: 'not-a-uuid' }],
      ['content is empty', { ...validPayload, content: '' }],
      ['content exceeds 4000 chars', { ...validPayload, content: 'x'.repeat(4001) }],
      ['type is not a MessageType value', { ...validPayload, type: 'sticker' }],
      ['payload is null', null],
    ])('acks invalid_payload when %s', async (_label, badPayload) => {
      const client = buildAuthedSocket();

      const ack = await gateway.handleSendMessage(client, badPayload);

      expect(ack).toEqual({ ok: false, error: 'invalid_payload' });
      expect(messagingService.sendMessage).not.toHaveBeenCalled();
    });

    it('acks unauthorized when client.data.userId is missing', async () => {
      const client = buildSocket() as RoomTrackingSocket;

      const ack = await gateway.handleSendMessage(client, validPayload);

      expect(ack).toEqual({ ok: false, error: 'unauthorized' });
      expect(messagingService.sendMessage).not.toHaveBeenCalled();
    });
  });
});

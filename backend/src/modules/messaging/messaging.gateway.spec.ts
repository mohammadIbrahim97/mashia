import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  KycStatus,
  MessageType,
  PreferredLanguage,
  UserRole,
} from '@shared/enums';
import { Message } from './message.entity';
import { AuthSocket, MessagingGateway } from './messaging.gateway';
import { UsersService } from '../users/users.service';
import { MessagingService } from './messaging.service';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const conversationId = '11111111-1111-4111-8111-111111111111';
const activeUser = {
  id: userId,
  role: UserRole.BUYER,
  fullName: 'Ahmad Ali',
  phone: '+966501234567',
  email: null,
  country: 'SA',
  city: 'Riyadh',
  kycStatus: KycStatus.PENDING,
  kycDocuments: null,
  preferredLanguage: PreferredLanguage.AR,
  passwordHash: null,
  totpSecret: null,
  totpEnabled: false,
  suspended: false,
  kycRejectionReason: null,
  kycReviewedAt: null,
  kycReviewedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

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

const buildDeepExtraPayload = (): { next?: unknown } => {
  const root: { next?: unknown } = {};
  let current = root;
  for (let i = 0; i < 3000; i += 1) {
    const next = {};
    current.next = next;
    current = next;
  }
  return root;
};

describe('MessagingGateway', () => {
  let gateway: MessagingGateway;
  let jwtService: jest.Mocked<Pick<JwtService, 'verify'>>;
  let messagingService: jest.Mocked<
    Pick<MessagingService, 'assertIsParticipant' | 'sendMessage' | 'markMessagesRead'>
  >;
  let usersService: jest.Mocked<Pick<UsersService, 'findById'>>;

  beforeEach(async () => {
    jwtService = { verify: jest.fn() };
    messagingService = {
      assertIsParticipant: jest.fn(),
      sendMessage: jest.fn(),
      markMessagesRead: jest.fn(),
    };
    usersService = {
      findById: jest.fn().mockResolvedValue(activeUser),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagingGateway,
        { provide: MessagingService, useValue: messagingService },
        { provide: JwtService, useValue: jwtService },
        { provide: UsersService, useValue: usersService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();
    gateway = moduleRef.get(MessagingGateway);
  });

  describe('handleConnection', () => {
    it('verifies token from handshake.auth.token and sets client.data.userId', async () => {
      const client = buildSocket({ auth: { token: 'valid.jwt.token' } });
      jwtService.verify.mockReturnValue({ sub: userId } as never);

      await gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith('valid.jwt.token', {
        secret: 'test-secret',
      });
      expect(usersService.findById).toHaveBeenCalledWith(userId);
      expect(client.data.userId).toBe(userId);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('falls back to Authorization Bearer header when handshake.auth has no token', async () => {
      const client = buildSocket({
        auth: {},
        headers: { authorization: 'Bearer header.jwt.token' },
      });
      jwtService.verify.mockReturnValue({ sub: userId } as never);

      await gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith('header.jwt.token', {
        secret: 'test-secret',
      });
      expect(client.data.userId).toBe(userId);
    });

    it('disconnects when no token is present', async () => {
      const client = buildSocket({ auth: {}, headers: {} });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(jwtService.verify).not.toHaveBeenCalled();
      expect(client.data.userId).toBeUndefined();
    });

    it('disconnects when the token belongs to a suspended user', async () => {
      const client = buildSocket({ auth: { token: 'valid.jwt.token' } });
      jwtService.verify.mockReturnValue({ sub: userId } as never);
      usersService.findById.mockResolvedValue({ ...activeUser, suspended: true });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.data.userId).toBeUndefined();
    });

    it('disconnects when the token user no longer exists', async () => {
      const client = buildSocket({ auth: { token: 'valid.jwt.token' } });
      jwtService.verify.mockReturnValue({ sub: userId } as never);
      usersService.findById.mockResolvedValue(null);

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.data.userId).toBeUndefined();
    });

    it('disconnects when token verification throws', async () => {
      const client = buildSocket({ auth: { token: 'bad.jwt' } });
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.data.userId).toBeUndefined();
    });

    it('ignores Authorization header that is not a Bearer scheme', async () => {
      const client = buildSocket({
        auth: {},
        headers: { authorization: 'Basic abc' },
      });

      await gateway.handleConnection(client);

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

    it('acks unauthorized and disconnects when user was suspended after connecting', async () => {
      const client = buildAuthedSocket();
      usersService.findById.mockResolvedValue({ ...activeUser, suspended: true });

      const ack = await gateway.handleJoinConversation(client, {
        conversationId,
      });

      expect(ack).toEqual({ ok: false, error: 'unauthorized' });
      expect(client.disconnect).toHaveBeenCalledWith(true);
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

    it('ignores deeply nested extra fields outside the DTO shape', async () => {
      const client = buildAuthedSocket();
      const saved = buildSavedMessage();
      messagingService.sendMessage.mockResolvedValue(saved);

      const ack = await gateway.handleSendMessage(client, {
        ...validPayload,
        unused: buildDeepExtraPayload(),
      });

      expect(messagingService.sendMessage).toHaveBeenCalledWith(
        conversationId,
        userId,
        'hello',
        MessageType.TEXT,
      );
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
      ['conversationId is deeply nested', { ...validPayload, conversationId: buildDeepExtraPayload() }],
      ['content is empty', { ...validPayload, content: '' }],
      ['content exceeds 4000 chars', { ...validPayload, content: 'x'.repeat(4001) }],
      ['content is deeply nested', { ...validPayload, content: buildDeepExtraPayload() }],
      ['type is not a MessageType value', { ...validPayload, type: 'sticker' }],
      ['type is deeply nested', { ...validPayload, type: buildDeepExtraPayload() }],
      ['payload is null', null],
    ])('acks invalid_payload when %s', async (_label, badPayload) => {
      const client = buildAuthedSocket();

      const ack = await gateway.handleSendMessage(client, badPayload);

      expect(ack).toEqual({ ok: false, error: 'invalid_payload' });
      expect(messagingService.sendMessage).not.toHaveBeenCalled();
    });

    it('acks unauthorized and disconnects when user was suspended after connecting', async () => {
      const client = buildAuthedSocket();
      usersService.findById.mockResolvedValue({ ...activeUser, suspended: true });

      const ack = await gateway.handleSendMessage(client, validPayload);

      expect(ack).toEqual({ ok: false, error: 'unauthorized' });
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(messagingService.sendMessage).not.toHaveBeenCalled();
    });

    it('acks unauthorized when client.data.userId is missing', async () => {
      const client = buildSocket() as RoomTrackingSocket;

      const ack = await gateway.handleSendMessage(client, {
        ...validPayload,
        unused: buildDeepExtraPayload(),
      });

      expect(ack).toEqual({ ok: false, error: 'unauthorized' });
      expect(messagingService.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleTyping', () => {
    const buildAuthedSocket = (): RoomTrackingSocket => {
      const client = buildSocket() as RoomTrackingSocket;
      client.data.userId = userId;
      return client;
    };

    const validPayload = { conversationId, isTyping: true };

    it('broadcasts typing status for active participants in joined rooms', async () => {
      const client = buildAuthedSocket();
      client.rooms.add(`conversation:${conversationId}`);
      const mocks = client as unknown as BroadcastMocks;
      messagingService.assertIsParticipant.mockResolvedValue(undefined);

      const ack = await gateway.handleTyping(client, validPayload);

      expect(messagingService.assertIsParticipant).toHaveBeenCalledWith(
        conversationId,
        userId,
      );
      expect(mocks.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
      expect(mocks.emit).toHaveBeenCalledWith('userTyping', {
        conversationId,
        userId,
        isTyping: true,
      });
      expect(ack).toEqual({ ok: true });
    });

    it('acks unauthorized and disconnects when user was suspended after connecting', async () => {
      const client = buildAuthedSocket();
      client.rooms.add(`conversation:${conversationId}`);
      usersService.findById.mockResolvedValue({ ...activeUser, suspended: true });

      const ack = await gateway.handleTyping(client, validPayload);

      expect(ack).toEqual({ ok: false, error: 'unauthorized' });
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(messagingService.assertIsParticipant).not.toHaveBeenCalled();
    });

    it('rejects typing events before the socket joins the conversation room', async () => {
      const client = buildAuthedSocket();
      const mocks = client as unknown as BroadcastMocks;

      const ack = await gateway.handleTyping(client, validPayload);

      expect(ack).toEqual({ ok: false, error: 'forbidden' });
      expect(usersService.findById).not.toHaveBeenCalled();
      expect(messagingService.assertIsParticipant).not.toHaveBeenCalled();
      expect(mocks.to).not.toHaveBeenCalled();
    });

    it('revalidates active users before suppressing duplicate typing states', async () => {
      const client = buildAuthedSocket();
      client.rooms.add(`conversation:${conversationId}`);
      const mocks = client as unknown as BroadcastMocks;
      messagingService.assertIsParticipant.mockResolvedValue(undefined);

      await gateway.handleTyping(client, validPayload);
      const ack = await gateway.handleTyping(client, validPayload);

      expect(ack).toEqual({ ok: true });
      expect(usersService.findById).toHaveBeenCalledTimes(2);
      expect(messagingService.assertIsParticipant).toHaveBeenCalledTimes(1);
      expect(mocks.to).toHaveBeenCalledTimes(1);
    });

    it('disconnects suspended users before suppressing duplicate typing states', async () => {
      const client = buildAuthedSocket();
      client.rooms.add(`conversation:${conversationId}`);
      const mocks = client as unknown as BroadcastMocks;
      messagingService.assertIsParticipant.mockResolvedValue(undefined);

      await gateway.handleTyping(client, validPayload);
      usersService.findById.mockResolvedValue({
        ...activeUser,
        suspended: true,
      });
      const ack = await gateway.handleTyping(client, validPayload);

      expect(ack).toEqual({ ok: false, error: 'unauthorized' });
      expect(usersService.findById).toHaveBeenCalledTimes(2);
      expect(messagingService.assertIsParticipant).toHaveBeenCalledTimes(1);
      expect(mocks.to).toHaveBeenCalledTimes(1);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('suppresses concurrent duplicate typing starts before duplicate active lookups', async () => {
      let resolveFindById: (user: typeof activeUser) => void = () => undefined;
      const findById = new Promise<typeof activeUser>((resolve) => {
        resolveFindById = resolve;
      });
      const client = buildAuthedSocket();
      client.rooms.add(`conversation:${conversationId}`);
      const mocks = client as unknown as BroadcastMocks;
      usersService.findById.mockReturnValue(findById);
      messagingService.assertIsParticipant.mockResolvedValue(undefined);

      const firstAck = gateway.handleTyping(client, validPayload);
      const secondAck = gateway.handleTyping(client, validPayload);

      expect(usersService.findById).toHaveBeenCalledTimes(1);
      expect(messagingService.assertIsParticipant).not.toHaveBeenCalled();
      expect(mocks.to).not.toHaveBeenCalled();

      resolveFindById(activeUser);
      await expect(firstAck).resolves.toEqual({ ok: true });
      await expect(secondAck).resolves.toEqual({ ok: true });
      expect(messagingService.assertIsParticipant).toHaveBeenCalledTimes(1);
      expect(mocks.to).toHaveBeenCalledTimes(1);
    });

    it('suppresses concurrent duplicate typing starts while participant checks are in flight', async () => {
      let resolveParticipant: () => void = () => undefined;
      const participantCheck = new Promise<void>((resolve) => {
        resolveParticipant = resolve;
      });
      const client = buildAuthedSocket();
      client.rooms.add(`conversation:${conversationId}`);
      const mocks = client as unknown as BroadcastMocks;
      messagingService.assertIsParticipant.mockReturnValue(participantCheck);

      const firstAck = gateway.handleTyping(client, validPayload);
      await Promise.resolve();
      const secondAck = gateway.handleTyping(client, validPayload);
      await Promise.resolve();

      expect(usersService.findById).toHaveBeenCalledTimes(1);
      expect(messagingService.assertIsParticipant).toHaveBeenCalledTimes(1);
      expect(mocks.to).not.toHaveBeenCalled();

      resolveParticipant();
      await expect(firstAck).resolves.toEqual({ ok: true });
      await expect(secondAck).resolves.toEqual({ ok: true });
      expect(mocks.to).toHaveBeenCalledTimes(1);
    });

    it('revalidates active users before rate limiting rapid typing-start transitions', async () => {
      const client = buildAuthedSocket();
      client.rooms.add(`conversation:${conversationId}`);
      const mocks = client as unknown as BroadcastMocks;
      const now = jest.spyOn(Date, 'now');
      now.mockReturnValue(1000);
      messagingService.assertIsParticipant.mockResolvedValue(undefined);

      await gateway.handleTyping(client, { conversationId, isTyping: true });
      now.mockReturnValue(1100);
      await gateway.handleTyping(client, { conversationId, isTyping: false });
      const ack = await gateway.handleTyping(client, {
        conversationId,
        isTyping: true,
      });

      expect(ack).toEqual({ ok: true });
      expect(usersService.findById).toHaveBeenCalledTimes(3);
      expect(messagingService.assertIsParticipant).toHaveBeenCalledTimes(2);
      expect(mocks.to).toHaveBeenCalledTimes(2);

      now.mockRestore();
    });

    it('does not cache typing attempts when participant validation fails', async () => {
      const client = buildAuthedSocket();
      client.rooms.add(`conversation:${conversationId}`);
      const mocks = client as unknown as BroadcastMocks;
      messagingService.assertIsParticipant.mockRejectedValue(
        new ForbiddenException(),
      );

      const firstAck = await gateway.handleTyping(client, validPayload);
      const secondAck = await gateway.handleTyping(client, validPayload);

      expect(firstAck).toEqual({ ok: false, error: 'forbidden' });
      expect(secondAck).toEqual({ ok: false, error: 'forbidden' });
      expect(usersService.findById).toHaveBeenCalledTimes(2);
      expect(messagingService.assertIsParticipant).toHaveBeenCalledTimes(2);
      expect(mocks.to).not.toHaveBeenCalled();
    });

    it('broadcasts typing-start transitions after the rate limit interval expires', async () => {
      const client = buildAuthedSocket();
      client.rooms.add(`conversation:${conversationId}`);
      const mocks = client as unknown as BroadcastMocks;
      const now = jest.spyOn(Date, 'now');
      now.mockReturnValue(1000);
      messagingService.assertIsParticipant.mockResolvedValue(undefined);

      await gateway.handleTyping(client, { conversationId, isTyping: true });
      now.mockReturnValue(1100);
      await gateway.handleTyping(client, { conversationId, isTyping: false });
      now.mockReturnValue(2000);
      const ack = await gateway.handleTyping(client, {
        conversationId,
        isTyping: true,
      });

      expect(ack).toEqual({ ok: true });
      expect(usersService.findById).toHaveBeenCalledTimes(3);
      expect(messagingService.assertIsParticipant).toHaveBeenCalledTimes(3);
      expect(mocks.to).toHaveBeenCalledTimes(3);

      now.mockRestore();
    });
  });

  describe('handleMarkRead', () => {
    const buildAuthedSocket = (): RoomTrackingSocket => {
      const client = buildSocket() as RoomTrackingSocket;
      client.data.userId = userId;
      return client;
    };

    const messageIds = [
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
    ];
    const validPayload = { conversationId, messageIds };

    it('persists, broadcasts to other sockets, and acks ok=true with updated ids + readAt', async () => {
      const client = buildAuthedSocket();
      const mocks = client as unknown as BroadcastMocks;
      const readAt = new Date('2026-05-03T12:00:00Z');
      messagingService.markMessagesRead.mockResolvedValue({
        updated: messageIds,
        readAt,
      });

      const ack = await gateway.handleMarkRead(client, validPayload);

      expect(messagingService.markMessagesRead).toHaveBeenCalledWith(
        conversationId,
        userId,
        messageIds,
      );
      expect(mocks.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
      expect(mocks.emit).toHaveBeenCalledWith('messageRead', {
        messageIds,
        readerId: userId,
        readAt,
      });
      expect(ack).toEqual({ ok: true, updated: messageIds, readAt });
    });

    it('ignores deeply nested extra fields outside the DTO shape', async () => {
      const client = buildAuthedSocket();
      messagingService.markMessagesRead.mockResolvedValue({
        updated: [],
        readAt: null,
      });

      const ack = await gateway.handleMarkRead(client, {
        ...validPayload,
        unused: buildDeepExtraPayload(),
      });

      expect(messagingService.markMessagesRead).toHaveBeenCalledWith(
        conversationId,
        userId,
        messageIds,
      );
      expect(ack).toEqual({ ok: true, updated: [], readAt: null });
    });

    it('does not broadcast when 0 rows updated (own messages or already read), but still acks ok=true', async () => {
      const client = buildAuthedSocket();
      const mocks = client as unknown as BroadcastMocks;
      messagingService.markMessagesRead.mockResolvedValue({
        updated: [],
        readAt: null,
      });

      const ack = await gateway.handleMarkRead(client, validPayload);

      expect(mocks.to).not.toHaveBeenCalled();
      expect(ack).toEqual({ ok: true, updated: [], readAt: null });
    });

    it('acks forbidden and does not broadcast when caller is not a participant', async () => {
      const client = buildAuthedSocket();
      const mocks = client as unknown as BroadcastMocks;
      messagingService.markMessagesRead.mockRejectedValue(
        new ForbiddenException(),
      );

      const ack = await gateway.handleMarkRead(client, validPayload);

      expect(ack).toEqual({ ok: false, error: 'forbidden' });
      expect(mocks.to).not.toHaveBeenCalled();
    });

    it('acks not_found when conversation does not exist', async () => {
      const client = buildAuthedSocket();
      const mocks = client as unknown as BroadcastMocks;
      messagingService.markMessagesRead.mockRejectedValue(
        new NotFoundException(),
      );

      const ack = await gateway.handleMarkRead(client, validPayload);

      expect(ack).toEqual({ ok: false, error: 'not_found' });
      expect(mocks.to).not.toHaveBeenCalled();
    });

    it('acks invalid_payload when read receipts are not supported for the conversation', async () => {
      const client = buildAuthedSocket();
      const mocks = client as unknown as BroadcastMocks;
      messagingService.markMessagesRead.mockRejectedValue(
        new BadRequestException(),
      );

      const ack = await gateway.handleMarkRead(client, validPayload);

      expect(ack).toEqual({ ok: false, error: 'invalid_payload' });
      expect(mocks.to).not.toHaveBeenCalled();
    });

    it.each<[string, unknown]>([
      ['conversationId is not a uuid v4', { ...validPayload, conversationId: 'not-a-uuid' }],
      ['messageIds is empty', { ...validPayload, messageIds: [] }],
      ['messageIds contains a non-uuid', { ...validPayload, messageIds: [messageIds[0], 'bad'] }],
      ['messageIds contains a deeply nested value', {
        ...validPayload,
        messageIds: [buildDeepExtraPayload()],
      }],
      ['messageIds exceeds 200 entries', {
        ...validPayload,
        messageIds: Array.from(
          { length: 201 },
          (_, i) => `${i.toString().padStart(8, '0')}-2222-4222-8222-222222222222`,
        ),
      }],
      ['messageIds is missing', { conversationId }],
      ['payload is null', null],
    ])('acks invalid_payload when %s', async (_label, badPayload) => {
      const client = buildAuthedSocket();

      const ack = await gateway.handleMarkRead(client, badPayload);

      expect(ack).toEqual({ ok: false, error: 'invalid_payload' });
      expect(messagingService.markMessagesRead).not.toHaveBeenCalled();
    });

    it('acks unauthorized and disconnects when user was suspended after connecting', async () => {
      const client = buildAuthedSocket();
      usersService.findById.mockResolvedValue({ ...activeUser, suspended: true });

      const ack = await gateway.handleMarkRead(client, validPayload);

      expect(ack).toEqual({ ok: false, error: 'unauthorized' });
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(messagingService.markMessagesRead).not.toHaveBeenCalled();
    });

    it('acks unauthorized when client.data.userId is missing', async () => {
      const client = buildSocket() as RoomTrackingSocket;

      const ack = await gateway.handleMarkRead(client, {
        ...validPayload,
        unused: buildDeepExtraPayload(),
      });

      expect(ack).toEqual({ ok: false, error: 'unauthorized' });
      expect(messagingService.markMessagesRead).not.toHaveBeenCalled();
    });
  });
});

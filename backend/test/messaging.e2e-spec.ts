import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { createTestApp } from './helpers/test-app';
import { truncateAll } from './helpers/truncate';
import { makeAuthenticatedUser, createListing } from './helpers/fixtures';
import { MessageType, UserRole } from '../src/shared/enums';

const ackTimeoutMs = 2000;
const broadcastTimeoutMs = 500;

describe('Messaging (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let port: number;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    await app.listen(0);
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected http server to bind to an address');
    }
    port = address.port;
  });

  beforeEach(async () => {
    await truncateAll(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  const connectChat = (token: string): Promise<Socket> =>
    new Promise((resolve, reject) => {
      const sock = io(`http://localhost:${port}/chat`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
      });
      sock.once('connect', () => resolve(sock));
      sock.once('connect_error', (e) => reject(e));
    });

  const emitAck = <T = unknown>(
    sock: Socket,
    event: string,
    payload: unknown,
  ): Promise<T> =>
    new Promise((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error(`ack timeout for ${event}`)),
        ackTimeoutMs,
      );
      sock.emit(event, payload, (ack: T) => {
        clearTimeout(t);
        resolve(ack);
      });
    });

  const waitFor = <T = unknown>(
    sock: Socket,
    event: string,
    timeoutMs: number = broadcastTimeoutMs,
  ): Promise<T> =>
    new Promise((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error(`event timeout for ${event}`)),
        timeoutMs,
      );
      sock.once(event, (payload: T) => {
        clearTimeout(t);
        resolve(payload);
      });
    });

  const seedConversation = async () => {
    const a = await makeAuthenticatedUser(app, { role: UserRole.BUYER });
    const b = await makeAuthenticatedUser(app, { role: UserRole.SELLER });
    const listing = await createListing(app, b.user);
    const created = await request(app.getHttpServer())
      .post('/api/v1/messaging/conversations')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ participantIds: [a.user.id, b.user.id], listingId: listing.id });
    return {
      userA: a.user,
      tokenA: a.token,
      userB: b.user,
      tokenB: b.token,
      listing,
      conversationId: created.body.id as string,
    };
  };

  describe('REST', () => {
    it('POST /messaging/conversations creates a conversation (201)', async () => {
      const a = await makeAuthenticatedUser(app, { role: UserRole.BUYER });
      const b = await makeAuthenticatedUser(app, { role: UserRole.SELLER });
      const listing = await createListing(app, b.user);

      const res = await request(app.getHttpServer())
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${a.token}`)
        .send({
          participantIds: [a.user.id, b.user.id],
          listingId: listing.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toEqual(expect.any(String));
      expect([...res.body.participantIds].sort()).toEqual(
        [a.user.id, b.user.id].sort(),
      );
      expect(res.body.listingId).toBe(listing.id);
    });

    it('POST /messaging/conversations is idempotent (200 + same id)', async () => {
      const a = await makeAuthenticatedUser(app, { role: UserRole.BUYER });
      const b = await makeAuthenticatedUser(app, { role: UserRole.SELLER });
      const listing = await createListing(app, b.user);
      const body = {
        participantIds: [a.user.id, b.user.id],
        listingId: listing.id,
      };

      const first = await request(app.getHttpServer())
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${a.token}`)
        .send(body);
      const second = await request(app.getHttpServer())
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${a.token}`)
        .send(body);

      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.body.id).toBe(first.body.id);
    });

    it('GET /messaging/conversations returns the user list with unreadCount = 0', async () => {
      const { tokenA, conversationId } = await seedConversation();

      const res = await request(app.getHttpServer())
        .get('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(conversationId);
      expect(res.body[0].unreadCount).toBe(0);
    });

    it('GET /messaging/conversations/:id/messages returns empty array when no messages', async () => {
      const { tokenA, conversationId } = await seedConversation();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/messaging/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('GET .../messages returns 403 for non-participant', async () => {
      const { conversationId } = await seedConversation();
      const c = await makeAuthenticatedUser(app, { role: UserRole.BUYER });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/messaging/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${c.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('WS', () => {
    let sockets: Socket[];

    beforeEach(() => {
      sockets = [];
    });

    afterEach(() => {
      for (const s of sockets) {
        if (s.connected) s.close();
      }
    });

    const track = (s: Socket): Socket => {
      sockets.push(s);
      return s;
    };

    it('A and B connect and both join the conversation room', async () => {
      const { tokenA, tokenB, conversationId } = await seedConversation();
      const sockA = track(await connectChat(tokenA));
      const sockB = track(await connectChat(tokenB));

      const ackA = await emitAck(sockA, 'joinConversation', { conversationId });
      const ackB = await emitAck(sockB, 'joinConversation', { conversationId });

      expect(ackA).toEqual({ ok: true });
      expect(ackB).toEqual({ ok: true });
    });

    it('A sendMessage → B receives newMessage with the persisted id', async () => {
      const { tokenA, tokenB, conversationId } = await seedConversation();
      const sockA = track(await connectChat(tokenA));
      const sockB = track(await connectChat(tokenB));
      await emitAck(sockA, 'joinConversation', { conversationId });
      await emitAck(sockB, 'joinConversation', { conversationId });

      const broadcastP = waitFor<{ id: string; content: string }>(
        sockB,
        'newMessage',
      );
      const ack = await emitAck<{
        ok: boolean;
        message: { id: string; content: string };
      }>(sockA, 'sendMessage', {
        conversationId,
        content: 'hello B',
        type: MessageType.TEXT,
      });

      expect(ack.ok).toBe(true);
      const broadcast = await broadcastP;
      expect(broadcast.id).toBe(ack.message.id);
      expect(broadcast.content).toBe('hello B');
    });

    it('B markRead → A receives messageRead with messageIds, readerId, readAt', async () => {
      const { tokenA, tokenB, userB, conversationId } =
        await seedConversation();
      const sockA = track(await connectChat(tokenA));
      const sockB = track(await connectChat(tokenB));
      await emitAck(sockA, 'joinConversation', { conversationId });
      await emitAck(sockB, 'joinConversation', { conversationId });

      const sendAck = await emitAck<{ message: { id: string } }>(
        sockA,
        'sendMessage',
        { conversationId, content: 'hi', type: MessageType.TEXT },
      );
      const messageId = sendAck.message.id;

      const broadcastP = waitFor<{
        messageIds: string[];
        readerId: string;
        readAt: string;
      }>(sockA, 'messageRead');
      const markAck = await emitAck<{ ok: boolean; updated: string[] }>(
        sockB,
        'markRead',
        { conversationId, messageIds: [messageId] },
      );

      expect(markAck.ok).toBe(true);
      expect(markAck.updated).toEqual([messageId]);

      const broadcast = await broadcastP;
      expect(broadcast.messageIds).toEqual([messageId]);
      expect(broadcast.readerId).toBe(userB.id);
      expect(broadcast.readAt).toEqual(expect.any(String));
    });

    it('Non-participant joinConversation → forbidden ack and no room membership', async () => {
      const { tokenA, conversationId } = await seedConversation();
      const c = await makeAuthenticatedUser(app, { role: UserRole.BUYER });
      const sockA = track(await connectChat(tokenA));
      const sockC = track(await connectChat(c.token));
      await emitAck(sockA, 'joinConversation', { conversationId });

      const ackC = await emitAck(sockC, 'joinConversation', { conversationId });
      expect(ackC).toEqual({ ok: false, error: 'forbidden' });

      // Prove C is not in the room: when A sends, C must not receive newMessage.
      let cReceived = false;
      sockC.once('newMessage', () => {
        cReceived = true;
      });
      await emitAck(sockA, 'sendMessage', {
        conversationId,
        content: 'private',
        type: MessageType.TEXT,
      });
      await new Promise((r) => setTimeout(r, 200));
      expect(cReceived).toBe(false);
    });
  });
});

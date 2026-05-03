/* eslint-disable @typescript-eslint/no-var-requires */
// Smoke test for the markRead WS event (issue #254).
// Seeds two users + a conversation + two messages (one peer, one own),
// connects both as socket.io clients, and verifies:
//   1. reader's ack lists ONLY the peer message id
//   2. the other client receives `messageRead` with that id
//   3. a second markRead with the same ids is idempotent (no broadcast)
//   4. DB row for the peer message has read_at set; own message stays NULL
//
// Run from backend/:
//   npm install --no-save socket.io-client
//   node scripts/smoke-mark-read.js

require('dotenv').config();
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');

const DB = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'sheep_marketplace',
  user: process.env.DB_USERNAME || 'sheep_user',
  password: process.env.DB_PASSWORD || 'sheep_pass_dev',
};
const JWT_SECRET = process.env.JWT_SECRET;
const apiUrl = new URL(process.env.API_URL || 'http://localhost:3000');
const WS_URL = `${apiUrl.protocol}//${apiUrl.host}`;

if (!JWT_SECRET) {
  console.error('JWT_SECRET is not set in .env');
  process.exit(1);
}

const READER_PHONE = '+966500099911';
const SENDER_PHONE = '+966500099912';

async function seed() {
  const db = new Client(DB);
  await db.connect();

  for (const [phone, name] of [
    [READER_PHONE, 'Smoke Reader'],
    [SENDER_PHONE, 'Smoke Sender'],
  ]) {
    await db.query(
      `INSERT INTO users (role, full_name, phone, country, city, kyc_status, preferred_language)
       VALUES ('buyer', $2, $1, 'SA', 'Riyadh', 'verified', 'ar')
       ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name`,
      [phone, name],
    );
  }

  const { rows: userRows } = await db.query(
    'SELECT id, phone, role FROM users WHERE phone = ANY($1::text[])',
    [[READER_PHONE, SENDER_PHONE]],
  );
  const reader = userRows.find((u) => u.phone === READER_PHONE);
  const sender = userRows.find((u) => u.phone === SENDER_PHONE);
  const participants = [reader.id, sender.id].sort();

  const { rows: convRows } = await db.query(
    `INSERT INTO conversations (participant_ids) VALUES ($1::uuid[]) RETURNING id`,
    [participants],
  );
  const conversationId = convRows[0].id;

  const { rows: peerMsgRows } = await db.query(
    `INSERT INTO messages (conversation_id, sender_id, content, type)
     VALUES ($1, $2, 'hi from sender', 'text') RETURNING id`,
    [conversationId, sender.id],
  );
  const { rows: ownMsgRows } = await db.query(
    `INSERT INTO messages (conversation_id, sender_id, content, type)
     VALUES ($1, $2, 'reply from reader', 'text') RETURNING id`,
    [conversationId, reader.id],
  );

  await db.end();
  return {
    reader,
    sender,
    conversationId,
    peerMessageId: peerMsgRows[0].id,
    ownMessageId: ownMsgRows[0].id,
  };
}

async function checkReadStates(peerMessageId, ownMessageId) {
  const db = new Client(DB);
  await db.connect();
  const { rows } = await db.query(
    `SELECT id, read_at FROM messages WHERE id = ANY($1::uuid[])`,
    [[peerMessageId, ownMessageId]],
  );
  await db.end();
  const peer = rows.find((r) => r.id === peerMessageId);
  const own = rows.find((r) => r.id === ownMessageId);
  return { peerReadAt: peer.read_at, ownReadAt: own.read_at };
}

function tokenFor(user) {
  return jwt.sign(
    { sub: user.id, phone: user.phone, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

function emitAck(sock, event, payload) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`ack timeout for ${event}`)), 5000);
    sock.emit(event, payload, (ack) => {
      clearTimeout(t);
      resolve(ack);
    });
  });
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const sock = io(`${WS_URL}/chat`, {
      auth: { token },
      transports: ['websocket'],
    });
    sock.once('connect', () => resolve(sock));
    sock.once('connect_error', (e) =>
      reject(new Error(`connect_error: ${e.message}`)),
    );
  });
}

function expect(label, cond, detail) {
  if (cond) {
    console.log(`  ok  — ${label}`);
  } else {
    console.error(`  FAIL — ${label}`, detail ?? '');
    process.exitCode = 1;
  }
}

(async () => {
  let readerSock;
  let senderSock;
  try {
    const { reader, sender, conversationId, peerMessageId, ownMessageId } =
      await seed();
    console.log('seeded:');
    console.log('  reader.id        =', reader.id);
    console.log('  sender.id        =', sender.id);
    console.log('  conversationId   =', conversationId);
    console.log('  peerMessageId    =', peerMessageId);
    console.log('  ownMessageId     =', ownMessageId);

    [readerSock, senderSock] = await Promise.all([
      connect(tokenFor(reader)),
      connect(tokenFor(sender)),
    ]);
    console.log('connected: reader', readerSock.id, '/ sender', senderSock.id);

    await emitAck(readerSock, 'joinConversation', { conversationId });
    await emitAck(senderSock, 'joinConversation', { conversationId });

    // Capture the broadcast on the sender side.
    const broadcasts = [];
    senderSock.on('messageRead', (payload) => broadcasts.push(payload));

    console.log('\n[1] reader marks both messages — own one must be excluded');
    const ack1 = await emitAck(readerSock, 'markRead', {
      conversationId,
      messageIds: [peerMessageId, ownMessageId],
    });
    console.log('  ack:', ack1);
    expect('ack ok=true', ack1.ok === true);
    expect(
      'updated has exactly the peer message id',
      Array.isArray(ack1.updated) &&
        ack1.updated.length === 1 &&
        ack1.updated[0] === peerMessageId,
      ack1.updated,
    );
    expect('readAt is a string/Date', !!ack1.readAt);

    // Give the broadcast a tick to arrive.
    await new Promise((r) => setTimeout(r, 100));
    expect('sender received exactly 1 messageRead broadcast', broadcasts.length === 1, broadcasts);
    if (broadcasts[0]) {
      expect(
        'broadcast.messageIds = [peerMessageId]',
        broadcasts[0].messageIds?.length === 1 &&
          broadcasts[0].messageIds[0] === peerMessageId,
        broadcasts[0],
      );
      expect('broadcast.readerId = reader.id', broadcasts[0].readerId === reader.id);
    }

    console.log('\n[2] reader marks again — idempotent, no new broadcast');
    const before = broadcasts.length;
    const ack2 = await emitAck(readerSock, 'markRead', {
      conversationId,
      messageIds: [peerMessageId, ownMessageId],
    });
    console.log('  ack:', ack2);
    expect('ack ok=true', ack2.ok === true);
    expect('updated is empty', Array.isArray(ack2.updated) && ack2.updated.length === 0);
    expect('readAt is null', ack2.readAt === null);
    await new Promise((r) => setTimeout(r, 100));
    expect('no additional messageRead broadcast', broadcasts.length === before);

    console.log('\n[3] DB state');
    const { peerReadAt, ownReadAt } = await checkReadStates(peerMessageId, ownMessageId);
    console.log('  peer.read_at =', peerReadAt);
    console.log('  own.read_at  =', ownReadAt);
    expect('peer message read_at set', peerReadAt instanceof Date);
    expect('own message read_at NULL', ownReadAt === null);

    console.log('\n[4] invalid payload acks');
    const badUuid = await emitAck(readerSock, 'markRead', {
      conversationId: 'not-a-uuid',
      messageIds: [peerMessageId],
    });
    expect('bad conversationId → invalid_payload', badUuid.ok === false && badUuid.error === 'invalid_payload', badUuid);
    const empty = await emitAck(readerSock, 'markRead', { conversationId, messageIds: [] });
    expect('empty messageIds → invalid_payload', empty.ok === false && empty.error === 'invalid_payload', empty);

    if (process.exitCode === 1) {
      console.error('\nsmoke test FAILED');
    } else {
      console.log('\nsmoke test OK');
    }
  } catch (err) {
    console.error('smoke test failed:', err);
    process.exitCode = 1;
  } finally {
    if (readerSock) readerSock.close();
    if (senderSock) senderSock.close();
    process.exit(process.exitCode ?? 0);
  }
})();

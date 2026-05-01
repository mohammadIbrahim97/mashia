/* eslint-disable @typescript-eslint/no-var-requires */
// Smoke test for the joinConversation WS event (issue #253).
// Bypasses OTP/login by inserting a user + conversation directly via pg
// and signing a JWT with JWT_SECRET from .env. Run from backend/:
//   npm install --no-save socket.io-client
//   node scripts/smoke-join-conversation.js

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

const TEST_PHONE = '+966500099901';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';

async function seed() {
  const db = new Client(DB);
  await db.connect();
  await db.query(
    `INSERT INTO users (role, full_name, phone, country, city, kyc_status, preferred_language)
     VALUES ('buyer', 'Smoke Test', $1, 'SA', 'Riyadh', 'verified', 'ar')
     ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name`,
    [TEST_PHONE],
  );
  const { rows: userRows } = await db.query(
    'SELECT id, role FROM users WHERE phone = $1',
    [TEST_PHONE],
  );
  const user = userRows[0];
  const participants = [user.id, OTHER_USER_ID].sort();
  const { rows: convRows } = await db.query(
    `INSERT INTO conversations (participant_ids) VALUES ($1::uuid[]) RETURNING id`,
    [participants],
  );
  await db.end();
  return { user, conversationId: convRows[0].id };
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

(async () => {
  try {
    const { user, conversationId } = await seed();
    console.log('seeded user.id =', user.id);
    console.log('seeded conversation.id =', conversationId);
    const token = jwt.sign(
      { sub: user.id, phone: TEST_PHONE, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' },
    );
    const sock = io(`${WS_URL}/chat`, {
      auth: { token },
      transports: ['websocket'],
    });
    await new Promise((resolve, reject) => {
      sock.once('connect', resolve);
      sock.once('connect_error', (e) =>
        reject(new Error(`connect_error: ${e.message}`)),
      );
    });
    console.log('connected, sid=', sock.id);
    console.log(
      'participant + valid uuid →',
      await emitAck(sock, 'joinConversation', { conversationId }),
    );
    console.log(
      'invalid uuid          →',
      await emitAck(sock, 'joinConversation', { conversationId: 'not-a-uuid' }),
    );
    console.log(
      'non-existent          →',
      await emitAck(sock, 'joinConversation', {
        conversationId: '99999999-9999-4999-8999-999999999999',
      }),
    );
    sock.close();
    console.log('smoke test OK');
    process.exit(0);
  } catch (err) {
    console.error('smoke test failed:', err);
    process.exit(1);
  }
})();

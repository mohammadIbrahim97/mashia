/* eslint-disable @typescript-eslint/no-var-requires */
// Seeds three demo users (buyer / seller / broker) with verified KYC.
// Run from backend/:
//   node scripts/seed-demo-users.js
//
// All three share the same phone-number range (+9665000010xx) so they
// don't collide with real users. The script is idempotent — re-running
// updates fields on conflict.
//
// To sign in as one of them from the mobile app:
//   1. enter the phone (e.g. +966500001001)
//   2. tap "Send code" — read the OTP from the backend logs
//      ([SMS] OTP for +966500001001: 123456)
//   3. enter the code

require('dotenv').config();
const { Client } = require('pg');

const DB = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'sheep_marketplace',
  user: process.env.DB_USERNAME || 'sheep_user',
  password: process.env.DB_PASSWORD || 'sheep_pass_dev',
};

const DEMOS = [
  {
    phone: '+966500001001',
    role: 'buyer',
    fullName: 'Khalid Al-Mutairi',
    country: 'SA',
    city: 'Riyadh',
    preferredLanguage: 'ar',
  },
  {
    phone: '+966500001002',
    role: 'seller',
    fullName: 'Yusuf Haddad',
    country: 'SY',
    city: 'Damascus',
    preferredLanguage: 'ar',
  },
  {
    phone: '+966500001003',
    role: 'broker',
    fullName: 'Sara Al-Sabah',
    country: 'KW',
    city: 'Kuwait City',
    preferredLanguage: 'en',
  },
];

(async () => {
  const db = new Client(DB);
  await db.connect();

  for (const u of DEMOS) {
    await db.query(
      `INSERT INTO users
         (role, full_name, phone, country, city, kyc_status, preferred_language)
       VALUES ($1, $2, $3, $4, $5, 'verified', $6)
       ON CONFLICT (phone) DO UPDATE SET
         role = EXCLUDED.role,
         full_name = EXCLUDED.full_name,
         country = EXCLUDED.country,
         city = EXCLUDED.city,
         kyc_status = EXCLUDED.kyc_status,
         preferred_language = EXCLUDED.preferred_language`,
      [u.role, u.fullName, u.phone, u.country, u.city, u.preferredLanguage],
    );
  }

  const { rows } = await db.query(
    `SELECT phone, role, full_name, country, city
       FROM users
      WHERE phone = ANY($1::text[])
      ORDER BY phone`,
    [DEMOS.map((d) => d.phone)],
  );

  await db.end();

  console.error('Demo users ready:');
  console.error('');
  for (const r of rows) {
    console.error(`  ${r.phone}  ${r.role.padEnd(7)}  ${r.full_name}`);
    console.error(`                    ${r.city}, ${r.country}`);
    console.error('');
  }
  console.error('Sign in: enter the phone in the app, tap "Send code", then');
  console.error('read the OTP from the backend log line:');
  console.error('  [SMS] OTP for +966500001001: 123456');
})().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});

/* eslint-disable @typescript-eslint/no-var-requires */
// Bootstrap script — creates an admin user with email + password (TOTP optional).
// Registration via /auth/register explicitly blocks the ADMIN role, so admins
// must be seeded out-of-band. Run from backend/:
//
//   node scripts/create-admin.js
//
// Prompts for email, password (twice), and full name. Then asks whether to set
// up TOTP — if yes, prints an otpauth:// URL you scan with an authenticator app
// and verifies a code before flipping totp_enabled.
//
// Re-running with the same email updates the password (idempotent).

require('dotenv').config();
const readline = require('node:readline');
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { authenticator } = require('otplib');

const DB = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'sheep_marketplace',
  user: process.env.DB_USERNAME || 'sheep_user',
  password: process.env.DB_PASSWORD || 'sheep_pass_dev',
};

const TOTP_ISSUER = 'Mashia Admin';

function prompt(question, { hide = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    if (hide && process.stdin.isTTY) {
      const stdin = process.openStdin();
      process.stdout.write(question);
      const onData = (char) => {
        const c = char.toString();
        if (c === '\n' || c === '\r' || c === '') {
          stdin.removeListener('data', onData);
        } else {
          process.stdout.clearLine(0);
          readline.cursorTo(process.stdout, 0);
          process.stdout.write(question + '*'.repeat(rl.line.length));
        }
      };
      stdin.on('data', onData);
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hide) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

(async () => {
  const client = new Client(DB);
  await client.connect();

  try {
    const email = await prompt('Email: ');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new Error('Invalid email format');
    }

    const password = await prompt('Password (min 12 chars): ', { hide: true });
    if (password.length < 12) {
      throw new Error('Password must be at least 12 characters');
    }
    const confirm = await prompt('Confirm password: ', { hide: true });
    if (password !== confirm) {
      throw new Error('Passwords do not match');
    }

    const fullName = await prompt('Full name: ');
    if (!fullName) throw new Error('Full name required');

    const phoneSeed = `+admin-${Date.now()}`; // synthetic phone (admins don't use OTP)
    const country = await prompt('Country (ISO, e.g. SA): ');
    const city = await prompt('City: ');

    const enableTotp = (await prompt('Set up TOTP now? [Y/n]: ')).toLowerCase() !== 'n';

    let totpSecret = null;
    let totpEnabled = false;

    if (enableTotp) {
      totpSecret = authenticator.generateSecret();
      const otpauthUrl = authenticator.keyuri(email, TOTP_ISSUER, totpSecret);
      console.log('\n--- TOTP setup ---');
      console.log('Scan this URL with your authenticator app (Google Authenticator, 1Password, Authy, etc.)');
      console.log(otpauthUrl);
      console.log('\nOr enter this secret manually:');
      console.log(totpSecret);
      console.log('---\n');

      const code = await prompt('Enter the 6-digit code from your app to confirm: ');
      if (!authenticator.verify({ token: code, secret: totpSecret })) {
        throw new Error('Invalid TOTP code — aborting');
      }
      totpEnabled = true;
      console.log('TOTP verified.\n');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Idempotent upsert — keyed on (email, role=admin).
    const existing = await client.query(
      `SELECT id FROM users WHERE email = $1 AND role = 'admin'`,
      [email],
    );

    if (existing.rowCount > 0) {
      const id = existing.rows[0].id;
      await client.query(
        `UPDATE users
           SET password_hash = $1,
               totp_secret = COALESCE($2, totp_secret),
               totp_enabled = $3,
               full_name = $4,
               country = $5,
               city = $6,
               updated_at = now()
         WHERE id = $7`,
        [passwordHash, totpSecret, totpEnabled, fullName, country, city, id],
      );
      console.log(`Updated admin ${email} (id=${id})`);
    } else {
      const result = await client.query(
        `INSERT INTO users
           (role, full_name, phone, email, country, city,
            kyc_status, preferred_language,
            password_hash, totp_secret, totp_enabled)
         VALUES ('admin', $1, $2, $3, $4, $5,
                 'verified', 'en',
                 $6, $7, $8)
         RETURNING id`,
        [fullName, phoneSeed, email, country, city, passwordHash, totpSecret, totpEnabled],
      );
      console.log(`Created admin ${email} (id=${result.rows[0].id})`);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();

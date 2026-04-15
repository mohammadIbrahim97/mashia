import { Client } from 'pg';

export default async function globalSetup(): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'sheep_user',
    password: process.env.DB_PASSWORD ?? 'sheep_pass_dev',
    database: 'postgres',
  });
  await client.connect();
  const res = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = 'mashia_test'`,
  );
  if (res.rowCount === 0) {
    await client.query(`CREATE DATABASE mashia_test`);
  }
  await client.end();

  process.env.DB_NAME = 'mashia_test';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-change-me';
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-change-me';
}

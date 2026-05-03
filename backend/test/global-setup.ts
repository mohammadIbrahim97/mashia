// Register TS path aliases so TypeORM can require entity files (e.g.
// '@shared/enums') when initialize() loads them via plain Node require.
// Jest's moduleNameMapper only applies inside test workers, not here.
import 'tsconfig-paths/register';
import { Client } from 'pg';

export default async function globalSetup(): Promise<void> {
  const sysClient = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? process.env.DB_USER ?? 'sheep_user',
    password: process.env.DB_PASSWORD ?? 'sheep_pass_dev',
    database: 'postgres',
  });
  await sysClient.connect();
  const res = await sysClient.query(
    `SELECT 1 FROM pg_database WHERE datname = 'mashia_test'`,
  );
  if (res.rowCount === 0) {
    await sysClient.query(`CREATE DATABASE mashia_test`);
  }
  await sysClient.end();

  // Init migration depends on uuid_generate_v4() — enable the extension on
  // mashia_test before running migrations.
  const dbClient = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? process.env.DB_USER ?? 'sheep_user',
    password: process.env.DB_PASSWORD ?? 'sheep_pass_dev',
    database: 'mashia_test',
  });
  await dbClient.connect();
  await dbClient.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await dbClient.end();

  process.env.DB_NAME = 'mashia_test';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-change-me';
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-change-me';

  // Apply migrations against mashia_test. data-source.ts reads DB_NAME at
  // construction time, so it must be required AFTER the env var is set.
  /* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
  const dataSource = require('../src/data-source').default;
  /* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
}

import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10) || 5432,
  username: process.env.DB_USERNAME || 'sheep_user',
  password: process.env.DB_PASSWORD || 'sheep_pass_dev',
  database: process.env.DB_NAME || 'sheep_marketplace',
  autoLoadEntities: true,
  synchronize: false,
}));

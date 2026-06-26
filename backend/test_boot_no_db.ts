import { NestFactory } from '@nestjs/core';
import { AuthModule } from './src/modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);
  await app.init();
  console.log('App booted successfully');
  await app.close();
}
bootstrap();

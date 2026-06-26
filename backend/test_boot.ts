import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.init();
  console.log('App booted successfully');
  await app.close();
}
bootstrap();

import 'reflect-metadata';
import { initSentry } from './shared/sentry/sentry';
initSentry();
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { SentryExceptionFilter } from './shared/sentry/sentry-exception.filter';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new SentryExceptionFilter(app.get(HttpAdapterHost).httpAdapter));

  app.use(helmet());

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());

  app.useWebSocketAdapter(new IoAdapter(app));

  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:8081'],
    credentials: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
  app.get(Logger).log(`Mashia API running on port ${port}`);
}
bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});

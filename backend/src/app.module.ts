import { randomUUID } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import s3Config from './config/s3.config';
import { RedisModule } from './shared/redis/redis.module';
import { S3Module } from './shared/s3/s3.module';
import { SmsModule } from './shared/sms/sms.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { KycModule } from './modules/kyc/kyc.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { ListingsModule } from './modules/listings/listings.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, s3Config],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('app.logLevel', 'info'),
          formatters: {
            level: (label: string) => ({ level: label }),
          },
          timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              "req.headers['x-api-key']",
              "res.headers['set-cookie']",
            ],
            censor: '[Redacted]',
          },
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const headerId = req.headers['x-request-id'];
            const id =
              (Array.isArray(headerId) ? headerId[0] : headerId) ||
              randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          customProps: (req: IncomingMessage) => ({ requestId: (req as IncomingMessage & { id?: string }).id }),
        },
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.database'),
        autoLoadEntities: true,
        synchronize: config.get('database.synchronize'),
      }),
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    RedisModule,
    S3Module,
    SmsModule,
    AuthModule,
    UsersModule,
    KycModule,
    UploadsModule,
    ListingsModule,
    OrdersModule,
    PaymentsModule,
    MessagingModule,
    CertificatesModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

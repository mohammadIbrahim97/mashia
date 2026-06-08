import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request } from 'express';
import * as Sentry from '@sentry/node';

function stripUrlQuery(url?: string): string | undefined {
  return url?.split(/[?#]/, 1)[0];
}

@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (!(exception instanceof HttpException)) {
      const req = host.switchToHttp().getRequest<Request & { id?: string }>();
      Sentry.captureException(exception, {
        extra: {
          requestId: req?.id,
          method: req?.method,
          url: stripUrlQuery(req?.originalUrl ?? req?.url),
        },
      });
    }
    super.catch(exception, host);
  }
}

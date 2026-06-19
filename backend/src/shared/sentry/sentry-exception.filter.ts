import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request } from 'express';
import * as Sentry from '@sentry/node';

function stripUrlQuery(url?: string): string | undefined {
  return url?.split(/[?#]/, 1)[0];
}

@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
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

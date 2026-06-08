import { ArgumentsHost, BadRequestException, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { SentryExceptionFilter } from './sentry-exception.filter';

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

describe('SentryExceptionFilter', () => {
  let filter: SentryExceptionFilter;
  let superCatch: jest.SpyInstance;

  const buildHost = (req: unknown): ArgumentsHost =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
    filter = new SentryExceptionFilter({} as never);
    superCatch = jest
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    superCatch.mockRestore();
  });

  it('captures unknown errors with requestId/method/url path only', () => {
    const err = new Error('boom');
    const host = buildHost({
      id: 'req-1',
      method: 'POST',
      originalUrl: '/api/v1/listings?token=secret&email=user%40example.com',
    });

    filter.catch(err, host);

    expect(Sentry.captureException).toHaveBeenCalledWith(err, {
      extra: {
        requestId: 'req-1',
        method: 'POST',
        url: '/api/v1/listings',
      },
    });
    expect(superCatch).toHaveBeenCalledWith(err, host);
  });

  it('falls back to req.url without query when originalUrl is missing', () => {
    const err = new Error('boom');
    const host = buildHost({ id: 'req-2', method: 'GET', url: '/x?otp=123456' });

    filter.catch(err, host);

    expect(Sentry.captureException).toHaveBeenCalledWith(err, {
      extra: { requestId: 'req-2', method: 'GET', url: '/x' },
    });
  });

  it('does not capture HttpException to Sentry', () => {
    const err: HttpException = new BadRequestException('bad input');
    const host = buildHost({ id: 'req-3', method: 'POST', url: '/x' });

    filter.catch(err, host);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(superCatch).toHaveBeenCalledWith(err, host);
  });
});

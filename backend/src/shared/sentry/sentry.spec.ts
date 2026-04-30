import * as Sentry from '@sentry/node';
import { initSentry } from './sentry';

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
}));

describe('initSentry', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SENTRY_DSN;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns false and does not init when DSN is unset', () => {
    const result = initSentry();
    expect(result).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('returns false and does not init when NODE_ENV=test', () => {
    process.env.SENTRY_DSN = 'https://abc@sentry.io/123';
    process.env.NODE_ENV = 'test';
    const result = initSentry();
    expect(result).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('calls Sentry.init with DSN and environment when both set', () => {
    process.env.SENTRY_DSN = 'https://abc@sentry.io/123';
    process.env.NODE_ENV = 'production';
    const result = initSentry();
    expect(result).toBe(true);
    expect(Sentry.init).toHaveBeenCalledWith({
      dsn: 'https://abc@sentry.io/123',
      environment: 'production',
      tracesSampleRate: 0,
    });
  });
});

import * as Sentry from '@sentry/node';

export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  const env = process.env.NODE_ENV || 'development';
  if (!dsn || env === 'test') {
    return false;
  }
  Sentry.init({
    dsn,
    environment: env,
    tracesSampleRate: 0,
  });
  return true;
}

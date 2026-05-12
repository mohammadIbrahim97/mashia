# 15 — Testing & Deployment

This chapter covers how to run tests, how CI verifies them, and how the eventual deploy will work. AWS infrastructure is not yet provisioned (see the `infra/` folder and tickets #82, #86–93, #239–246).

## Backend tests

The backend ships with **322 tests across 30 files** (Jest). Run them from `backend/`:

```bash
npm test                 # unit + spec
npm run test:watch       # watch mode
npm run test:cov         # coverage
npm run test:e2e         # e2e (Supertest)
```

### What's tested

- Each service has a `*.service.spec.ts` covering happy path + the rejection branches the controller relies on.
- Each controller has a `*.controller.spec.ts` that mocks the service and asserts the routing + guards.
- The `MessagingGateway` has gateway-level integration tests in `messaging.gateway.spec.ts`.
- The escrow stub has its own test (`escrow.service.spec.ts`).
- The auto-release cron has tests that fake the system clock and verify the SQL filter.

### What's *not* tested

- End-to-end with a real Postgres — most specs mock the repository. There are no integration tests with a transactional rollback.
- Socket.io network behaviour beyond the gateway unit. The `scripts/smoke-*.js` files do manual smoke testing.
- The `EscrowService` against any real gateway (it's a stub).
- Multi-replica cron concurrency. Trust `skip_locked`; verify in staging.

### Writing a new test

Follow these patterns:

- **Service spec**: stub the repository with `Object.assign(repo, { findOne: jest.fn(), save: jest.fn() })`. Stub the event emitter with `{ emit: jest.fn() }`. Assert the side effects: which rows were saved, which events were emitted, with what payload.
- **Controller spec**: mock the service entirely. Assert that the controller passes the right args (especially `user.id`) and returns the wrapped result.
- **Cross-module behaviour** (e.g. payment → order transition): write the test on the listener (`payment-status.listener.spec.ts` is the template) rather than spanning services.

DTO validation is tested implicitly via `ValidationPipe` in e2e; for unit tests on DTOs you can use `validate(plainToInstance(SomeDto, payload))`.

## Mobile tests

`mobile/jest.config.js` runs unit tests. Today coverage is sparse — components and screens are mostly untested. The conventions to introduce when you start adding tests:

- Use `@testing-library/react-native` (already a dep).
- Mock `axios` via `jest.mock('../services/api')`.
- Mock `react-native-keychain` and `react-native-image-picker` at the file level.
- For Zustand stores, import the store and call its actions directly — no need for `renderHook` in most cases.

## Admin tests

`admin/` has Next.js out of the box. No tests configured today. If you add them:

- Use Playwright for end-to-end (real browser) against a running stack.
- Use Jest + `@testing-library/react` for component tests.

## Linting

| Project | Command |
|---|---|
| backend | `npm run lint` |
| mobile | `npm run lint` |
| admin | `npm run lint` |

ESLint configs are in each project's `.eslintrc.*` file. The backend config is the most opinionated (full `@typescript-eslint/strict` rules). Keep CI green.

## CI

`.github/workflows/` has lint+test pipelines. Triggers:

- **Backend CI** on push to `develop` or PR that touches `backend/**`. Runs `npm ci`, `lint`, `test`.
- **Mobile CI** on touch to `mobile/**`. Runs `lint`, `test`, and builds the Android bundle. iOS build is not automated.
- **Admin CI** on touch to `admin/**`. Runs `lint`, `next build`.

The standard branch flow:

```bash
# feature branch
git checkout -b feature/short-name
# ... work ...
git push -u origin feature/short-name
# open PR against develop

# once approved
git checkout develop
git pull origin develop
git merge --no-ff origin/feature/short-name
git push origin develop
```

CI re-runs on the `develop` push (because the file paths change). The README at the repo root has the up-to-date list of issues and merge instructions.

## Deployment (target: AWS Bahrain, me-south-1)

Not provisioned yet. The plan tracked in `infra/` and root README:

| Component | Status | Issues |
|---|---|---|
| RDS PostgreSQL Multi-AZ | not provisioned | #88, #239 |
| ElastiCache Redis | not provisioned | #89, #240 |
| S3 bucket (server-side encrypted) | not provisioned | #90, #241 |
| ECR repo for backend Docker image | not provisioned | #242 |
| ECS Fargate service + ALB + healthchecks | not provisioned | #243 |
| GitHub Actions CD (Docker → ECR → ECS) | not provisioned | #244, #87 |
| CloudFront CDN for media | not provisioned | #92, #246 |
| CloudWatch monitoring + log aggregation | not provisioned | #91, #245 |

`backend/Dockerfile` and `admin/Dockerfile` are already in the repo (multi-stage builds, slim runtime images). `infra/ecs-task-definition.json`, `infra/rds-config.md`, and `infra/s3-bucket-policy.json` are checked-in starting points.

## Migrations in production

When you merge a feature with a new migration:

1. Migration file goes into `backend/db/migrations/` named `<timestamp>-<Description>.ts`.
2. Local: `npm run migration:run` applies it.
3. CD pipeline (once it exists) must run `npm run migration:run` against the live DB **before** the new container starts serving traffic. ECS task definitions support a `command` override for one-off jobs — the recommended pattern is a "migrate" task that runs first, then deploys the new app revision.
4. Never use `synchronize: true` in non-test environments. The Nest config reads `database.synchronize` from `config/database.config.ts`; that file should keep it `false` unless `NODE_ENV === 'test'`.

## Rolling back

If a migration goes wrong:

```bash
npm run migration:revert    # reverts the most recent migration
```

In production you'd run that *before* rolling the container back. Plan the rollback strategy when you write the migration:

- Additive changes (new columns with defaults, new tables) are safe — revert is straightforward.
- Destructive changes (drops, renames, type narrowings) require a multi-phase migration: add the new column, double-write, backfill, switch reads, drop the old column. Don't do all four in one PR.

## Observability

- **Logging**: `nestjs-pino` produces structured JSON logs with a `requestId` correlation key (extracted from `x-request-id` header or generated). In dev they're pretty-printed; in prod they should ship to CloudWatch via the container stdout.
- **Errors**: `SentryExceptionFilter` (`backend/src/shared/sentry/`) captures uncaught exceptions. Set `SENTRY_DSN` env var to enable. The init helper is at `shared/sentry/sentry.ts`.
- **Tracing**: not configured. If you add it, prefer OpenTelemetry over the Sentry tracing SDK so traces don't depend on the error pipeline.

## Smoke tests post-deploy

Once a deploy lands:

1. `curl https://api.<host>/api/v1/listings` should return `{"success":true,"data":{...}}`.
2. Try a full demo-user round trip from the mobile app pointing at the prod API.
3. Tail CloudWatch for any error spikes for 10 minutes.
4. Check the auto-release cron has run at the next quarter-hour (`PaymentsService.processAutoReleases` logs each release count).

## Secrets

Never check secrets in. The `.env.example` lists the variables but the production values come from AWS Secrets Manager → ECS environment. The cluster needs:

- `DATABASE_URL` or `DB_*` quartet.
- `REDIS_URL` or `REDIS_HOST` + `REDIS_PORT`.
- `JWT_SECRET`, `JWT_REFRESH_SECRET`. **Different per environment.**
- `AWS_REGION` + S3 bucket name. IAM role on the task gives access — don't pass keys.
- `SENTRY_DSN` (optional).
- `SMS_PROVIDER`, `UNIFONIC_API_KEY` (or whatever the production provider's vars are) — required to swap out `ConsoleSmsService`.

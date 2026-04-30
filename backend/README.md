# Mashia Backend

NestJS + TypeORM + Postgres.

## Setup

From the repo root:

```bash
cp .env.example .env
docker compose up -d postgres redis
```

Then in `backend/`:

```bash
npm install
npm run migration:run     # apply schema
npm run start:dev
```

## Migrations

`synchronize` is **off in every environment** — schema changes ship as
migration files in `db/migrations/`, named with a Unix-ms timestamp prefix.
TypeORM applies them in timestamp order.

### Apply

```bash
npm run migration:run
```

### Generate from entity changes

After editing an `*.entity.ts`:

```bash
npm run migration:generate -- db/migrations/<DescriptiveName>
```

This diffs entity metadata against the live DB and writes a new file. Review
the SQL before committing.

### Revert the last migration

```bash
npm run migration:revert
```

### Production

`migrationsRun` is off; run migrations as an explicit deploy step before
starting the app.

import { DataSource } from 'typeorm';

export async function truncateAll(dataSource: DataSource): Promise<void> {
  const tables = dataSource.entityMetadatas
    .map((m) => `"${m.tableName}"`)
    .join(', ');
  await dataSource.query(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`,
  );
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentsAutoReleaseHeldIndex1777382579000
  implements MigrationInterface
{
  name = 'PaymentsAutoReleaseHeldIndex1777382579000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_auto_release_held
      ON payments (auto_release_at)
      WHERE escrow_status = 'held'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payments_auto_release_held`);
  }
}

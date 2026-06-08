import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEscrowInProgressStatuses1777900000000 implements MigrationInterface {
  name = 'AddEscrowInProgressStatuses1777900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."payments_escrow_status_enum" ADD VALUE IF NOT EXISTS 'releasing'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."payments_escrow_status_enum" ADD VALUE IF NOT EXISTS 'refunding'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "escrow_status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_escrow_status_enum_old" AS ENUM('held', 'released', 'refunded')`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "escrow_status" TYPE "public"."payments_escrow_status_enum_old" USING CASE WHEN "escrow_status"::text IN ('releasing', 'refunding') THEN 'held' ELSE "escrow_status"::text END::"public"."payments_escrow_status_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."payments_escrow_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."payments_escrow_status_enum_old" RENAME TO "payments_escrow_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "escrow_status" SET DEFAULT 'held'`,
    );
  }
}

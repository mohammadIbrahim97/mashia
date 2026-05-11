import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminUserReview1777800000000 implements MigrationInterface {
  name = 'AdminUserReview1777800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "suspended" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "kyc_rejection_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "kyc_reviewed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "kyc_reviewed_by_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_kyc_reviewed_by_id" FOREIGN KEY ("kyc_reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_kyc_status" ON "users" ("kyc_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_suspended_true" ON "users" ("id") WHERE "suspended" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_users_suspended_true"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_users_kyc_status"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_kyc_reviewed_by_id"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "kyc_reviewed_by_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "kyc_reviewed_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "kyc_rejection_reason"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "suspended"`);
  }
}

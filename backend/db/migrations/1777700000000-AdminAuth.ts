import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminAuth1777700000000 implements MigrationInterface {
  name = 'AdminAuth1777700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_hash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "totp_secret" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "totp_enabled" boolean NOT NULL DEFAULT false`,
    );
    // Admins must have a unique email; non-admins are not constrained.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_users_admin_email_unique" ON "users" ("email") WHERE "role" = 'admin'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_users_admin_email_unique"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totp_enabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totp_secret"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password_hash"`);
  }
}

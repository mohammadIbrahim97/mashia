import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCertificates1777600000000 implements MigrationInterface {
  name = 'CreateCertificates1777600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."certificates_type_enum" AS ENUM('vaccination', 'health', 'origin')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."certificates_status_enum" AS ENUM('pending', 'verified', 'rejected')`,
    );
    await queryRunner.query(`
      CREATE TABLE "certificates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "seller_id" uuid NOT NULL,
        "listing_id" uuid,
        "type" "public"."certificates_type_enum" NOT NULL,
        "issuing_authority" character varying(200) NOT NULL,
        "issue_date" date NOT NULL,
        "expiry_date" date NOT NULL,
        "file_url" character varying NOT NULL,
        "status" "public"."certificates_status_enum" NOT NULL DEFAULT 'pending',
        "verified_by_id" uuid,
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "rejection_reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_certificates" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "certificates"
      ADD CONSTRAINT "FK_certificates_seller_id"
      FOREIGN KEY ("seller_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "certificates"
      ADD CONSTRAINT "FK_certificates_listing_id"
      FOREIGN KEY ("listing_id") REFERENCES "listings"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "certificates"
      ADD CONSTRAINT "FK_certificates_verified_by_id"
      FOREIGN KEY ("verified_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_certificates_seller_id" ON "certificates" ("seller_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_certificates_listing_id" ON "certificates" ("listing_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_certificates_status" ON "certificates" ("status")`,
    );
    await queryRunner.query(`
      ALTER TABLE "listings"
      ADD CONSTRAINT "FK_listings_certificate_id"
      FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "listings" DROP CONSTRAINT IF EXISTS "FK_listings_certificate_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_certificates_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_certificates_listing_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_certificates_seller_id"`);
    await queryRunner.query(
      `ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "FK_certificates_verified_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "FK_certificates_listing_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "FK_certificates_seller_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "certificates"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."certificates_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."certificates_type_enum"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateConversations1777500000000 implements MigrationInterface {
  name = 'CreateConversations1777500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "participant_ids" uuid[] NOT NULL,
        "listing_id" uuid,
        "order_id" uuid,
        "last_message_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD CONSTRAINT "FK_conversations_listing_id"
      FOREIGN KEY ("listing_id") REFERENCES "listings"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD CONSTRAINT "FK_conversations_order_id"
      FOREIGN KEY ("order_id") REFERENCES "orders"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_conversations_participant_ids"
      ON "conversations" USING GIN ("participant_ids")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_conversations_listing_id"
      ON "conversations" ("listing_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_conversations_listing_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_conversations_participant_ids"`);
    await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "FK_conversations_order_id"`);
    await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "FK_conversations_listing_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversations"`);
  }
}

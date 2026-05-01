import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMessages1777500001000 implements MigrationInterface {
  name = 'CreateMessages1777500001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."messages_type_enum"
      AS ENUM ('text', 'image', 'certificate', 'offer')
    `);

    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "sender_id" uuid NOT NULL,
        "content" text NOT NULL,
        "type" "public"."messages_type_enum" NOT NULL DEFAULT 'text',
        "read_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD CONSTRAINT "FK_messages_conversation_id"
      FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD CONSTRAINT "FK_messages_sender_id"
      FOREIGN KEY ("sender_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_messages_conversation_created"
      ON "messages" ("conversation_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_messages_conversation_created"`);
    await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "FK_messages_sender_id"`);
    await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "FK_messages_conversation_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."messages_type_enum"`);
  }
}

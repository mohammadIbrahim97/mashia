import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderIndexes1778100000000 implements MigrationInterface {
  name = 'AddOrderIndexes1778100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_orders_buyer_id" ON "orders" ("buyer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_seller_id" ON "orders" ("seller_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_broker_id" ON "orders" ("broker_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_orders_broker_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_orders_seller_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_orders_buyer_id"`);
  }
}

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderListingIndexes1780000000000 implements MigrationInterface {
    name = 'AddOrderListingIndexes1780000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "idx_listings_seller_id" ON "listings" ("seller_id") `);
        await queryRunner.query(`CREATE INDEX "idx_listings_status" ON "listings" ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_listings_breed" ON "listings" ("breed") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_listing_id" ON "orders" ("listing_id") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_buyer_id" ON "orders" ("buyer_id") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_seller_id" ON "orders" ("seller_id") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_status" ON "orders" ("status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_orders_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_seller_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_buyer_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_listing_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_listings_breed"`);
        await queryRunner.query(`DROP INDEX "public"."idx_listings_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_listings_seller_id"`);
    }

}

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexes1730000000000 implements MigrationInterface {
    name = 'AddIndexes1730000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_orders_buyerId" ON "orders" ("buyer_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_orders_sellerId" ON "orders" ("seller_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_orders_brokerId" ON "orders" ("broker_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_orders_listingId" ON "orders" ("listing_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_orders_status" ON "orders" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_orders_createdAt" ON "orders" ("created_at")`);

        await queryRunner.query(`CREATE INDEX "IDX_listings_sellerId" ON "listings" ("seller_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_listings_status" ON "listings" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_listings_createdAt" ON "listings" ("created_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_listings_createdAt"`);
        await queryRunner.query(`DROP INDEX "IDX_listings_status"`);
        await queryRunner.query(`DROP INDEX "IDX_listings_sellerId"`);

        await queryRunner.query(`DROP INDEX "IDX_orders_createdAt"`);
        await queryRunner.query(`DROP INDEX "IDX_orders_status"`);
        await queryRunner.query(`DROP INDEX "IDX_orders_listingId"`);
        await queryRunner.query(`DROP INDEX "IDX_orders_brokerId"`);
        await queryRunner.query(`DROP INDEX "IDX_orders_sellerId"`);
        await queryRunner.query(`DROP INDEX "IDX_orders_buyerId"`);
    }
}

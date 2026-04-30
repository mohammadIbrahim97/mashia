import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1700000000000 implements MigrationInterface {
    name = 'Init1700000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('seller', 'buyer', 'broker', 'admin')`);
        await queryRunner.query(`CREATE TYPE "public"."users_kyc_status_enum" AS ENUM('pending', 'verified', 'rejected')`);
        await queryRunner.query(`CREATE TYPE "public"."users_preferred_language_enum" AS ENUM('ar', 'tr', 'en')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role" "public"."users_role_enum" NOT NULL, "full_name" character varying NOT NULL, "phone" character varying NOT NULL, "email" character varying, "country" character varying NOT NULL, "city" character varying NOT NULL, "kyc_status" "public"."users_kyc_status_enum" NOT NULL DEFAULT 'pending', "kyc_documents" jsonb, "preferred_language" "public"."users_preferred_language_enum" NOT NULL DEFAULT 'ar', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."listings_breed_enum" AS ENUM('awassi', 'najdi', 'arabi', 'shami', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."listings_currency_enum" AS ENUM('SYP', 'SAR', 'AED', 'USD')`);
        await queryRunner.query(`CREATE TYPE "public"."listings_health_status_enum" AS ENUM('certified', 'pending', 'unchecked')`);
        await queryRunner.query(`CREATE TYPE "public"."listings_status_enum" AS ENUM('active', 'sold', 'expired', 'flagged')`);
        await queryRunner.query(`CREATE TABLE "listings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "seller_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "breed" "public"."listings_breed_enum" NOT NULL, "quantity" integer NOT NULL, "age_months" integer NOT NULL, "weight_kg" numeric(10,2) NOT NULL, "price_per_head" numeric(12,2) NOT NULL, "currency" "public"."listings_currency_enum" NOT NULL, "origin_country" character varying(100) NOT NULL, "origin_city" character varying(100) NOT NULL, "description" text, "images" jsonb NOT NULL, "video_url" character varying, "health_status" "public"."listings_health_status_enum" NOT NULL DEFAULT 'unchecked', "certificate_id" uuid, "status" "public"."listings_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_520ecac6c99ec90bcf5a603cdcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."orders_currency_enum" AS ENUM('SYP', 'SAR', 'AED', 'USD')`);
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('pending', 'accepted', 'paid', 'in_transit', 'delivered', 'completed', 'disputed', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "listing_id" uuid, "buyer_id" uuid NOT NULL, "seller_id" uuid NOT NULL, "broker_id" uuid, "quantity" integer NOT NULL, "unit_price" numeric(12,2) NOT NULL, "currency" "public"."orders_currency_enum" NOT NULL, "total_price" numeric(14,2) NOT NULL, "commission_rate" numeric(5,2) NOT NULL DEFAULT '5', "commission_amount" numeric(14,2) NOT NULL DEFAULT '0', "status" "public"."orders_status_enum" NOT NULL DEFAULT 'pending', "delivery_country" character varying NOT NULL, "delivery_city" character varying NOT NULL, "delivery_address" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."payments_currency_enum" AS ENUM('SYP', 'SAR', 'AED', 'USD')`);
        await queryRunner.query(`CREATE TYPE "public"."payments_method_enum" AS ENUM('stc_pay', 'mada', 'bank_transfer')`);
        await queryRunner.query(`CREATE TYPE "public"."payments_escrow_status_enum" AS ENUM('held', 'released', 'refunded')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "payer_id" uuid NOT NULL, "amount" numeric(14,2) NOT NULL, "commission_amount" numeric(14,2) NOT NULL, "seller_amount" numeric(14,2) NOT NULL, "currency" "public"."payments_currency_enum" NOT NULL, "method" "public"."payments_method_enum" NOT NULL, "escrow_status" "public"."payments_escrow_status_enum" NOT NULL DEFAULT 'held', "transaction_ref" text NOT NULL, "auto_release_at" TIMESTAMP WITH TIME ZONE, "paid_at" TIMESTAMP WITH TIME ZONE NOT NULL, "released_at" TIMESTAMP WITH TIME ZONE, "refunded_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b2f7b823a21562eeca20e72b00" ON "payments" ("order_id") `);
        await queryRunner.query(`CREATE INDEX "idx_payments_auto_release_held" ON "payments" ("auto_release_at") WHERE escrow_status = 'held'`);
        await queryRunner.query(`ALTER TABLE "listings" ADD CONSTRAINT "FK_6d2846ee6b337ce5225c8c7286b" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_6488f7cc8c58e53c5cecc8866c6" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_5e90e93d0e036c3fadbaefa4d0a" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_ef6710c78c6fbc26d1ba58268ab" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_db35659b50f7c713b2b9a51b811" FOREIGN KEY ("broker_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_b2f7b823a21562eeca20e72b006" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_02f8e8d4094492641ad95010ca1" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_02f8e8d4094492641ad95010ca1"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_b2f7b823a21562eeca20e72b006"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_db35659b50f7c713b2b9a51b811"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_ef6710c78c6fbc26d1ba58268ab"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_5e90e93d0e036c3fadbaefa4d0a"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_6488f7cc8c58e53c5cecc8866c6"`);
        await queryRunner.query(`ALTER TABLE "listings" DROP CONSTRAINT "FK_6d2846ee6b337ce5225c8c7286b"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payments_auto_release_held"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b2f7b823a21562eeca20e72b00"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_escrow_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_method_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_currency_enum"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."orders_currency_enum"`);
        await queryRunner.query(`DROP TABLE "listings"`);
        await queryRunner.query(`DROP TYPE "public"."listings_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."listings_health_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."listings_currency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."listings_breed_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_preferred_language_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_kyc_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}

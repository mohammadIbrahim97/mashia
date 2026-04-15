import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { createTestApp } from './helpers/test-app';
import { truncateAll } from './helpers/truncate';
import {
  makeAuthenticatedUser,
  createListing,
  createOrder,
} from './helpers/fixtures';
import { captureEvents, EventCapture } from './helpers/event-capture';
import { KycStatus, OrderStatus, UserRole } from '../src/shared/enums';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let events: EventCapture;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    events = captureEvents(app);
  });

  beforeEach(async () => {
    await truncateAll(dataSource);
    events.reset();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/orders', () => {
    it('creates an order (happy path): BUYER + VERIFIED KYC, correct decimals', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
        kycStatus: KycStatus.VERIFIED,
      });
      const { user: buyer, token } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
        kycStatus: KycStatus.VERIFIED,
      });
      const listing = await createListing(app, seller);

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          listingId: listing.id,
          quantity: 10,
          unitPrice: 1150,
          deliveryCountry: 'SA',
          deliveryCity: 'Riyadh',
          deliveryAddress: '123 Market St',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.buyerId).toBe(buyer.id);
      expect(res.body.sellerId).toBe(seller.id);
      expect(Number(res.body.totalPrice)).toBe(11500);
      expect(Number(res.body.commissionAmount)).toBe(575);
      expect(res.body.status).toBe(OrderStatus.PENDING);
    });

    it('returns 401 when no JWT is provided', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const listing = await createListing(app, seller);

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .send({
          listingId: listing.id,
          quantity: 10,
          unitPrice: 1150,
          deliveryCountry: 'SA',
          deliveryCity: 'Riyadh',
          deliveryAddress: '123 Market St',
        });

      expect(res.status).toBe(401);
    });

    it('returns 403 when SELLER role attempts to place an order (RolesGuard)', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { token } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
        kycStatus: KycStatus.VERIFIED,
      });
      const listing = await createListing(app, seller);

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          listingId: listing.id,
          quantity: 10,
          unitPrice: 1150,
          deliveryCountry: 'SA',
          deliveryCity: 'Riyadh',
          deliveryAddress: '123 Market St',
        });

      expect(res.status).toBe(403);
    });

    it('returns 403 when BUYER has PENDING KYC (KycVerifiedGuard)', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { token } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
        kycStatus: KycStatus.PENDING,
      });
      const listing = await createListing(app, seller);

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          listingId: listing.id,
          quantity: 10,
          unitPrice: 1150,
          deliveryCountry: 'SA',
          deliveryCity: 'Riyadh',
          deliveryAddress: '123 Market St',
        });

      expect(res.status).toBe(403);
    });

    it('returns 400 when DTO is invalid (negative quantity, ValidationPipe)', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { token } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
        kycStatus: KycStatus.VERIFIED,
      });
      const listing = await createListing(app, seller);

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          listingId: listing.id,
          quantity: -5,
          unitPrice: 1150,
          deliveryCountry: 'SA',
          deliveryCity: 'Riyadh',
          deliveryAddress: '123 Market St',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/orders/:id/status', () => {
    it('allows seller to transition PENDING → ACCEPTED', async () => {
      const { user: seller, token: sellerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.SELLER },
      );
      const { user: buyer } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const listing = await createListing(app, seller);
      const order = await createOrder(app, buyer, seller, listing);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ status: OrderStatus.ACCEPTED });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(OrderStatus.ACCEPTED);
    });

    it('returns 404 when caller is not a party (privacy)', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const { token: strangerToken } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const listing = await createListing(app, seller);
      const order = await createOrder(app, buyer, seller, listing);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ status: OrderStatus.CANCELLED });

      expect(res.status).toBe(404);
    });

    it('returns 400 on invalid transition (PENDING → DELIVERED)', async () => {
      const { user: seller, token: sellerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.SELLER },
      );
      const { user: buyer } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const listing = await createListing(app, seller);
      const order = await createOrder(app, buyer, seller, listing);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ status: OrderStatus.DELIVERED });

      expect(res.status).toBe(400);
    });

    it('emits OrderDeliveredEvent when buyer transitions IN_TRANSIT → DELIVERED', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const listing = await createListing(app, seller);
      const order = await createOrder(app, buyer, seller, listing, {
        status: OrderStatus.IN_TRANSIT,
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ status: OrderStatus.DELIVERED });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(OrderStatus.DELIVERED);

      const delivered = events.getEmitted('order.delivered');
      expect(delivered).toHaveLength(1);
      expect(delivered[0]).toEqual(
        expect.objectContaining({
          orderId: order.id,
          buyerId: buyer.id,
          sellerId: seller.id,
        }),
      );
    });
  });

  describe('GET /api/v1/orders', () => {
    it('returns mixed buyer+seller orders with correct myRole per item', async () => {
      const { user: me, token } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const { user: other } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });

      const listing1 = await createListing(app, other);
      await createOrder(app, me, other, listing1);

      const listing2 = await createListing(app, me);
      const { user: anotherBuyer } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      await createOrder(app, anotherBuyer, me, listing2);

      const res = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.total).toBe(2);

      const roles = res.body.items.map((i: { myRole: string }) => i.myRole).sort();
      expect(roles).toEqual(['buyer', 'seller']);
    });

    it('paginates correctly (25 orders, page=2, pageSize=10)', async () => {
      const { user: me, token } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const listing = await createListing(app, seller);

      for (let i = 0; i < 25; i += 1) {
        await createOrder(app, me, seller, listing);
      }

      const res = await request(app.getHttpServer())
        .get('/api/v1/orders?page=2&pageSize=10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(10);
      expect(res.body.total).toBe(25);
      expect(res.body.page).toBe(2);
      expect(res.body.pageSize).toBe(10);
      expect(res.body.totalPages).toBe(3);
    });

    it('filters by status array (?status=pending&status=accepted)', async () => {
      const { user: me, token } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const listing = await createListing(app, seller);

      await createOrder(app, me, seller, listing, { status: OrderStatus.PENDING });
      await createOrder(app, me, seller, listing, { status: OrderStatus.ACCEPTED });
      await createOrder(app, me, seller, listing, { status: OrderStatus.PAID });
      await createOrder(app, me, seller, listing, { status: OrderStatus.COMPLETED });

      const res = await request(app.getHttpServer())
        .get('/api/v1/orders?status=pending&status=accepted')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      const statuses = res.body.items
        .map((i: { status: string }) => i.status)
        .sort();
      expect(statuses).toEqual([OrderStatus.ACCEPTED, OrderStatus.PENDING]);
    });

    it('returns 401 when no JWT is provided', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/orders');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/orders/:id', () => {
    it('returns full detail (with phone, delivery address) for party', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
        fullName: 'Seller Two',
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER, fullName: 'Buyer Two' },
      );
      const listing = await createListing(app, seller);
      const order = await createOrder(app, buyer, seller, listing);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(order.id);
      expect(res.body.myRole).toBe('buyer');
      expect(res.body.deliveryAddress).toBe('123 Test St');
      expect(res.body.buyer.phone).toBe(buyer.phone);
      expect(res.body.seller.phone).toBe(seller.phone);
    });

    it('returns 404 when order does not exist', async () => {
      const { token } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 when caller is not a party (privacy)', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const { token: strangerToken } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const listing = await createListing(app, seller);
      const order = await createOrder(app, buyer, seller, listing);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(404);
    });
  });
});

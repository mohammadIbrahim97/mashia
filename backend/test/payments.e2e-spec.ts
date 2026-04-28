import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createTestApp } from './helpers/test-app';
import { truncateAll } from './helpers/truncate';
import { captureEvents, EventCapture } from './helpers/event-capture';
import {
  createAcceptedOrder,
  makeAuthenticatedUser,
} from './helpers/fixtures';
import { Payment } from '../src/modules/payments/payment.entity';
import { Order } from '../src/modules/orders/order.entity';
import { PaymentHeldEvent } from '@shared/events/payment-held.event';
import { PaymentsService } from '../src/modules/payments/payments.service';
import {
  EscrowStatus,
  OrderStatus,
  PaymentMethod,
  UserRole,
} from '../src/shared/enums/index';

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let events: EventCapture;
  let paymentsRepo: Repository<Payment>;
  let ordersRepo: Repository<Order>;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    paymentsRepo = app.get<Repository<Payment>>(getRepositoryToken(Payment));
    ordersRepo = app.get<Repository<Order>>(getRepositoryToken(Order));
    events = captureEvents(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(dataSource);
    events.reset();
  });

  describe('POST /api/v1/payments/initiate', () => {
    it('holds funds, transitions order ACCEPTED → PAID, emits payment.held', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { order } = await createAcceptedOrder(app, buyer, seller);

      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });

      expect(res.status).toBe(201);
      expect(res.body.escrowStatus).toBe(EscrowStatus.HELD);
      expect(res.body.orderId).toBe(order.id);
      expect(res.body.transactionRef).toMatch(/^STUB-/);
      expect(Number(res.body.sellerAmount)).toBeCloseTo(
        Number(order.totalPrice) * 0.95,
        2,
      );

      const savedPayment = await paymentsRepo.findOne({
        where: { id: res.body.id },
      });
      expect(savedPayment?.escrowStatus).toBe(EscrowStatus.HELD);

      // Allow the async PaymentStatusListener (@OnEvent) to finish before
      // asserting the order status transition.
      await new Promise((r) => setImmediate(r));

      const updatedOrder = await ordersRepo.findOne({
        where: { id: order.id },
      });
      expect(updatedOrder?.status).toBe(OrderStatus.PAID);

      expect(events.getEmitted(PaymentHeldEvent.EVENT_NAME).length).toBe(1);
    });
  });

  describe('POST /api/v1/payments/:id/release', () => {
    async function setupDeliveredPayment() {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { order } = await createAcceptedOrder(app, buyer, seller);
      const initRes = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });
      expect(initRes.status).toBe(201);

      // Poll until the payment.held listener finishes the ACCEPTED → PAID transition
      let orderAfterInit = await ordersRepo.findOne({ where: { id: order.id } });
      for (let i = 0; i < 20 && orderAfterInit?.status !== OrderStatus.PAID; i++) {
        await new Promise((r) => setImmediate(r));
        orderAfterInit = await ordersRepo.findOne({ where: { id: order.id } });
      }

      // Move order through IN_TRANSIT → DELIVERED via direct repo
      await ordersRepo.update(order.id, { status: OrderStatus.IN_TRANSIT });
      await ordersRepo.update(order.id, { status: OrderStatus.DELIVERED });

      return {
        buyerToken,
        paymentId: initRes.body.id,
        orderId: order.id,
      };
    }

    it('releases payment, transitions order DELIVERED → COMPLETED, emits payment.released', async () => {
      const { buyerToken, paymentId, orderId } = await setupDeliveredPayment();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentId}/release`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.escrowStatus).toBe(EscrowStatus.RELEASED);
      expect(res.body.releasedAt).not.toBeNull();

      // Poll until the payment.released listener finishes the DELIVERED → COMPLETED transition
      let updatedOrder = await ordersRepo.findOne({ where: { id: orderId } });
      for (let i = 0; i < 20 && updatedOrder?.status !== OrderStatus.COMPLETED; i++) {
        await new Promise((r) => setImmediate(r));
        updatedOrder = await ordersRepo.findOne({ where: { id: orderId } });
      }
      expect(updatedOrder?.status).toBe(OrderStatus.COMPLETED);

      expect(events.getEmitted('payment.released').length).toBe(1);
    });

    it('returns 404 when caller is not the payer', async () => {
      const { paymentId } = await setupDeliveredPayment();
      const { token: strangerToken } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentId}/release`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 400 when order is not DELIVERED', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { order } = await createAcceptedOrder(app, buyer, seller);
      const initRes = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });

      await new Promise((r) => setImmediate(r));
      // Order is PAID (listener moved it after initiate), not DELIVERED

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${initRes.body.id}/release`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/payments/:id/refund', () => {
    async function setupDisputedPayment() {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { order } = await createAcceptedOrder(app, buyer, seller);
      const initRes = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });
      expect(initRes.status).toBe(201);

      // Wait for payment.held listener to finish ACCEPTED → PAID
      let current = await ordersRepo.findOne({ where: { id: order.id } });
      for (let i = 0; i < 20 && current?.status !== OrderStatus.PAID; i++) {
        await new Promise((r) => setImmediate(r));
        current = await ordersRepo.findOne({ where: { id: order.id } });
      }

      // Move order to DISPUTED directly (no HTTP path exists yet)
      await ordersRepo.update(order.id, { status: OrderStatus.DISPUTED });

      return { paymentId: initRes.body.id, orderId: order.id, buyerToken };
    }

    it('admin refunds disputed payment, order → CANCELLED, emits payment.refunded', async () => {
      const { paymentId, orderId } = await setupDisputedPayment();
      const { token: adminToken } = await makeAuthenticatedUser(app, {
        role: UserRole.ADMIN,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.escrowStatus).toBe(EscrowStatus.REFUNDED);

      // Wait for payment.refunded listener to finish DISPUTED → CANCELLED
      let updatedOrder = await ordersRepo.findOne({ where: { id: orderId } });
      for (
        let i = 0;
        i < 20 && updatedOrder?.status !== OrderStatus.CANCELLED;
        i++
      ) {
        await new Promise((r) => setImmediate(r));
        updatedOrder = await ordersRepo.findOne({ where: { id: orderId } });
      }
      expect(updatedOrder?.status).toBe(OrderStatus.CANCELLED);

      expect(events.getEmitted('payment.refunded').length).toBe(1);
    });

    it('non-admin gets 403', async () => {
      const { paymentId, buyerToken } = await setupDisputedPayment();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send();
      expect(res.status).toBe(403);
    });
  });

  describe('auto-release cron', () => {
    it('releases HELD payment past autoReleaseAt on DELIVERED order', async () => {
      const paymentsService = app.get(PaymentsService);
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { order } = await createAcceptedOrder(app, buyer, seller);
      const initRes = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });

      // Wait for payment.held listener to finish
      let current = await ordersRepo.findOne({ where: { id: order.id } });
      for (let i = 0; i < 20 && current?.status !== OrderStatus.PAID; i++) {
        await new Promise((r) => setImmediate(r));
        current = await ordersRepo.findOne({ where: { id: order.id } });
      }

      // Force order to DELIVERED and backdate autoReleaseAt to 1 minute ago
      await ordersRepo.update(order.id, { status: OrderStatus.DELIVERED });
      await paymentsRepo.update(initRes.body.id, {
        autoReleaseAt: new Date(Date.now() - 60 * 1000),
      });

      const count = await paymentsService.processAutoReleases();

      expect(count).toBe(1);
      const updatedPayment = await paymentsRepo.findOne({
        where: { id: initRes.body.id },
      });
      expect(updatedPayment?.escrowStatus).toBe(EscrowStatus.RELEASED);

      // Wait for payment.released listener to finish DELIVERED → COMPLETED
      let updatedOrder = await ordersRepo.findOne({ where: { id: order.id } });
      for (
        let i = 0;
        i < 20 && updatedOrder?.status !== OrderStatus.COMPLETED;
        i++
      ) {
        await new Promise((r) => setImmediate(r));
        updatedOrder = await ordersRepo.findOne({ where: { id: order.id } });
      }
      expect(updatedOrder?.status).toBe(OrderStatus.COMPLETED);
    });

    it('skips payments whose order is DISPUTED (not DELIVERED)', async () => {
      const paymentsService = app.get(PaymentsService);
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { order } = await createAcceptedOrder(app, buyer, seller);
      const initRes = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });

      let current = await ordersRepo.findOne({ where: { id: order.id } });
      for (let i = 0; i < 20 && current?.status !== OrderStatus.PAID; i++) {
        await new Promise((r) => setImmediate(r));
        current = await ordersRepo.findOne({ where: { id: order.id } });
      }

      await ordersRepo.update(order.id, { status: OrderStatus.DISPUTED });
      await paymentsRepo.update(initRes.body.id, {
        autoReleaseAt: new Date(Date.now() - 60 * 1000),
      });

      const count = await paymentsService.processAutoReleases();
      expect(count).toBe(0);
      const payment = await paymentsRepo.findOne({
        where: { id: initRes.body.id },
      });
      expect(payment?.escrowStatus).toBe(EscrowStatus.HELD);
    });
  });

  describe('GET /api/v1/payments/:id and GET /api/v1/payments/by-order/:orderId', () => {
    it('payer and admin see, stranger gets 404; missing payment 404', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { token: adminToken } = await makeAuthenticatedUser(app, {
        role: UserRole.ADMIN,
      });
      const { token: strangerToken } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });

      const { order } = await createAcceptedOrder(app, buyer, seller);
      const initRes = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });

      const paymentId = initRes.body.id;

      // Payer can see by id
      await request(app.getHttpServer())
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      // Admin can see by id
      await request(app.getHttpServer())
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Unrelated stranger gets 404 (not 403)
      await request(app.getHttpServer())
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(404);

      // Payer can look up by orderId
      await request(app.getHttpServer())
        .get(`/api/v1/payments/by-order/${order.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      // Stranger lookup by orderId also 404
      await request(app.getHttpServer())
        .get(`/api/v1/payments/by-order/${order.id}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(404);

      // Missing payment: create a second ACCEPTED order without paying
      const { order: unpaid } = await createAcceptedOrder(app, buyer, seller);
      await request(app.getHttpServer())
        .get(`/api/v1/payments/by-order/${unpaid.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(404);
    });
  });

  describe('order.delivered → autoReleaseAt', () => {
    it('sets autoReleaseAt ~7 days out when order transitions to DELIVERED', async () => {
      const { user: seller, token: sellerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.SELLER },
      );
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { order } = await createAcceptedOrder(app, buyer, seller);
      const initRes = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });

      // Wait for held listener: ACCEPTED → PAID
      let current = await ordersRepo.findOne({ where: { id: order.id } });
      for (let i = 0; i < 20 && current?.status !== OrderStatus.PAID; i++) {
        await new Promise((r) => setImmediate(r));
        current = await ordersRepo.findOne({ where: { id: order.id } });
      }

      // Seller ships (PAID → IN_TRANSIT)
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ status: OrderStatus.IN_TRANSIT })
        .expect(200);

      // Buyer confirms delivery (IN_TRANSIT → DELIVERED)
      // This fires order.delivered → OrderDeliveredListener sets autoReleaseAt
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ status: OrderStatus.DELIVERED })
        .expect(200);

      // Poll for autoReleaseAt to be set
      let payment = await paymentsRepo.findOne({ where: { id: initRes.body.id } });
      for (let i = 0; i < 20 && payment?.autoReleaseAt === null; i++) {
        await new Promise((r) => setImmediate(r));
        payment = await paymentsRepo.findOne({ where: { id: initRes.body.id } });
      }

      expect(payment?.autoReleaseAt).not.toBeNull();
      const expected = Date.now() + 7 * 86400 * 1000;
      expect(
        Math.abs((payment!.autoReleaseAt as Date).getTime() - expected),
      ).toBeLessThan(60 * 1000);
    });
  });
});

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
import { PaymentHeldEvent } from '../src/modules/payments/events/payment-held.event';
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
        .send({ reason: 'fraud reported' });

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
        .send({});
      expect(res.status).toBe(403);
    });
  });
});

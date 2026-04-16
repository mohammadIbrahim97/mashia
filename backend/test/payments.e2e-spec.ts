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
});

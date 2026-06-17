import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './src/modules/payments/payments.service';
import { DataSource } from 'typeorm';
import { EscrowService } from './src/modules/payments/escrow.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EscrowStatus } from '@shared/enums';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from './src/modules/payments/payment.entity';
import { Order } from './src/modules/orders/order.entity';

// Mock dependencies
const mockPaymentsRepository = {
  createQueryBuilder: () => ({}),
};

const mockOrdersRepository = {};

const mockEscrowService = {
  releaseFunds: async () => new Promise((resolve) => setTimeout(resolve, 50)), // 50ms simulated API delay
};

const mockEventEmitter = {
  emit: () => {},
};

const mockDataSource = {
  transaction: async (cb: any) => {
    return cb({
      createQueryBuilder: () => ({
        innerJoin: () => ({
          where: () => ({
            andWhere: () => ({
              andWhere: () => ({
                andWhere: () => ({
                  addSelect: () => ({
                    setLock: () => ({
                      setOnLocked: () => ({
                        getRawAndEntities: async () => {
                          // Mock 50 rows
                          const entities = Array.from({ length: 50 }).map((_, i) => ({
                            id: `payment-${i}`,
                            transactionRef: `ref-${i}`,
                            orderId: `order-${i}`,
                            sellerAmount: 100,
                            currency: 'USD',
                            escrowStatus: EscrowStatus.HELD,
                          }));
                          const raw = Array.from({ length: 50 }).map((_, i) => ({
                            order_seller_id: `seller-${i}`,
                          }));
                          return { entities, raw };
                        }
                      })
                    })
                  })
                })
              })
            })
          })
        })
      }),
      save: async (entity: any) => entity,
      findOne: async () => ({ escrowStatus: EscrowStatus.RELEASING }),
    });
  },
};

async function runBenchmark() {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PaymentsService,
      { provide: getRepositoryToken(Payment), useValue: mockPaymentsRepository },
      { provide: getRepositoryToken(Order), useValue: mockOrdersRepository },
      { provide: EscrowService, useValue: mockEscrowService },
      { provide: EventEmitter2, useValue: mockEventEmitter },
      { provide: DataSource, useValue: mockDataSource },
    ],
  }).compile();

  const service = module.get<PaymentsService>(PaymentsService);

  const start = Date.now();
  await service.processAutoReleases();
  const end = Date.now();

  console.log(`Time taken: ${end - start}ms`);
}

runBenchmark().catch(console.error);

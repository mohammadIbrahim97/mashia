import { Test } from '@nestjs/testing';
import { EscrowService } from './escrow.service';
import { Currency, EscrowStatus, PaymentMethod } from '@shared/enums';

describe('EscrowService (stub)', () => {
  let service: EscrowService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [EscrowService],
    }).compile();
    service = module.get(EscrowService);
  });

  it('holdFunds returns a STUB-prefixed transactionRef', async () => {
    const result = await service.holdFunds(1000, Currency.SAR, PaymentMethod.MADA);
    expect(result.transactionRef).toMatch(/^STUB-[0-9a-f-]{36}$/);
    expect(result.status).toBe(EscrowStatus.HELD);
  });

  it('releaseFunds echoes the ref and returns status released', async () => {
    const ref = 'STUB-11111111-1111-1111-1111-111111111111';
    const result = await service.releaseFunds(ref);
    expect(result.transactionRef).toBe(ref);
    expect(result.status).toBe(EscrowStatus.RELEASED);
  });

  it('refundFunds echoes the ref and returns status refunded', async () => {
    const ref = 'STUB-22222222-2222-2222-2222-222222222222';
    const result = await service.refundFunds(ref);
    expect(result.transactionRef).toBe(ref);
    expect(result.status).toBe(EscrowStatus.REFUNDED);
  });
});

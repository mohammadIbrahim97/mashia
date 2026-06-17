import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Currency, EscrowStatus, PaymentMethod } from '@shared/enums';

export interface EscrowResult {
  transactionRef: string;
  status: EscrowStatus;
}

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  async holdFunds(
    amount: number,
    currency: Currency,
    method: PaymentMethod,
  ): Promise<EscrowResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Escrow operations are unavailable until actual integration is configured',
      );
    }
    const transactionRef = `STUB-${randomUUID()}`;
    this.logger.log(
      `[stub] holdFunds ${amount} ${currency} via ${method} → ${transactionRef}`,
    );
    return { transactionRef, status: EscrowStatus.HELD };
  }

  async releaseFunds(transactionRef: string): Promise<EscrowResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Escrow operations are unavailable until actual integration is configured',
      );
    }
    this.logger.log(`[stub] releaseFunds ${transactionRef}`);
    return { transactionRef, status: EscrowStatus.RELEASED };
  }

  async refundFunds(transactionRef: string): Promise<EscrowResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Escrow operations are unavailable until actual integration is configured',
      );
    }
    this.logger.log(`[stub] refundFunds ${transactionRef}`);
    return { transactionRef, status: EscrowStatus.REFUNDED };
  }
}

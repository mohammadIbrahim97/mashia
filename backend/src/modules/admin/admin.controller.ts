import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { UserRole } from '@shared/enums';
import { User } from '../users/user.entity';
import { ProfileResponseDto } from '../users/dto/profile-response.dto';
import { Order } from '../orders/order.entity';
import { Payment } from '../payments/payment.entity';
import { CertificatesService } from '../certificates/certificates.service';
import { UsersService } from '../users/users.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { ListingsService } from '../listings/listings.service';
import { AdminService } from './admin.service';
import { AdminCertificatesQueryDto } from './dto/admin-certificates-query.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { AdminKycDecisionDto } from './dto/admin-kyc-decision.dto';
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { AdminListingsQueryDto } from './dto/admin-listings-query.dto';
import {
  AdminPaymentsQueryDto,
  AdminRevenueQueryDto,
} from './dto/admin-payments-query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly certificatesService: CertificatesService,
    private readonly usersService: UsersService,
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly listingsService: ListingsService,
  ) {}

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  // ----- Certificates -----

  @Get('certificates')
  async listCertificates(@Query() query: AdminCertificatesQueryDto) {
    return this.certificatesService.findForAdmin(query);
  }

  // ----- Users (G3-US03) -----

  @Get('users')
  async listUsers(@Query() query: AdminUsersQueryDto) {
    return this.usersService.findForAdmin(query);
  }

  @Get('users/:id')
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findByIdForAdmin(id);
  }

  @Patch('users/:id/kyc')
  async reviewKyc(
    @CurrentUser() admin: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminKycDecisionDto,
  ): Promise<ProfileResponseDto> {
    const user = await this.usersService.reviewKyc(admin.id, id, {
      decision: dto.decision,
      rejectionReason: dto.rejectionReason,
    });
    return ProfileResponseDto.fromUser(user);
  }

  @Patch('users/:id/suspend')
  async suspend(@Param('id', ParseUUIDPipe) id: string): Promise<ProfileResponseDto> {
    const user = await this.usersService.setSuspended(id, true);
    return ProfileResponseDto.fromUser(user);
  }

  @Patch('users/:id/unsuspend')
  async unsuspend(@Param('id', ParseUUIDPipe) id: string): Promise<ProfileResponseDto> {
    const user = await this.usersService.setSuspended(id, false);
    return ProfileResponseDto.fromUser(user);
  }

  // ----- Orders (G3-US06) -----

  @Get('orders')
  async listOrders(@Query() query: AdminOrdersQueryDto) {
    return this.ordersService.findForAdmin(query);
  }

  @Get('orders/:id')
  async getOrder(@Param('id', ParseUUIDPipe) id: string) {
    const [order, payment] = await Promise.all([
      this.ordersService.findOneForAdmin(id),
      this.paymentsService.findByOrderForAdmin(id),
    ]);
    return this.toAdminOrderDetail(order, payment);
  }

  @Post('orders/:id/release')
  async forceRelease(@Param('id', ParseUUIDPipe) id: string) {
    const payment = await this.paymentsService.forceReleaseByOrder(id);
    const order = await this.ordersService.findOneForAdmin(id);
    return this.toAdminOrderDetail(order, payment);
  }

  @Post('orders/:id/refund')
  async refund(@Param('id', ParseUUIDPipe) id: string) {
    const payment = await this.paymentsService.refundByOrder(id);
    const order = await this.ordersService.findOneForAdmin(id);
    return this.toAdminOrderDetail(order, payment);
  }

  private toAdminOrderDetail(order: Order, payment: Payment | null) {
    return {
      order: {
        id: order.id,
        listingId: order.listingId,
        listing: order.listing
          ? { id: order.listing.id, title: order.listing.title }
          : null,
        buyerId: order.buyerId,
        buyer: order.buyer
          ? {
              id: order.buyer.id,
              fullName: order.buyer.fullName,
              phone: order.buyer.phone,
            }
          : null,
        sellerId: order.sellerId,
        seller: order.seller
          ? {
              id: order.seller.id,
              fullName: order.seller.fullName,
              phone: order.seller.phone,
            }
          : null,
        brokerId: order.brokerId,
        quantity: order.quantity,
        unitPrice: Number(order.unitPrice),
        currency: order.currency,
        totalPrice: Number(order.totalPrice),
        commissionRate: Number(order.commissionRate),
        commissionAmount: Number(order.commissionAmount),
        status: order.status,
        deliveryCountry: order.deliveryCountry,
        deliveryCity: order.deliveryCity,
        deliveryAddress: order.deliveryAddress,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      payment: payment
        ? {
            id: payment.id,
            amount: Number(payment.amount),
            sellerAmount: Number(payment.sellerAmount),
            commissionAmount: Number(payment.commissionAmount),
            currency: payment.currency,
            method: payment.method,
            escrowStatus: payment.escrowStatus,
            releasedAt: payment.releasedAt,
            refundedAt: payment.refundedAt,
            autoReleaseAt: payment.autoReleaseAt,
            createdAt: payment.createdAt,
          }
        : null,
    };
  }

  // ----- Listings (G3-US04) -----

  @Get('listings')
  async listListings(@Query() query: AdminListingsQueryDto) {
    return this.listingsService.findForAdmin(query);
  }

  @Get('listings/:id')
  async getListing(@Param('id', ParseUUIDPipe) id: string) {
    return this.listingsService.findByIdForAdmin(id);
  }

  @Patch('listings/:id/flag')
  async flagListing(@Param('id', ParseUUIDPipe) id: string) {
    return this.listingsService.setFlag(id, true);
  }

  @Patch('listings/:id/unflag')
  async unflagListing(@Param('id', ParseUUIDPipe) id: string) {
    return this.listingsService.setFlag(id, false);
  }

  @Delete('listings/:id')
  async removeListing(@Param('id', ParseUUIDPipe) id: string) {
    return this.listingsService.removeByAdmin(id);
  }

  // ----- Payments + revenue (G3-US07) -----

  @Get('payments')
  async listPayments(@Query() query: AdminPaymentsQueryDto) {
    return this.paymentsService.findForAdmin(query);
  }

  @Get('revenue')
  async getRevenue(@Query() query: AdminRevenueQueryDto) {
    return this.paymentsService.getRevenueSummary(query);
  }
}

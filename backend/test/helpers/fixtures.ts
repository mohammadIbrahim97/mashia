import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/modules/users/user.entity';
import { Listing } from '../../src/modules/listings/listing.entity';
import { Order } from '../../src/modules/orders/order.entity';
import {
  Breed,
  Currency,
  HealthStatus,
  KycStatus,
  ListingStatus,
  OrderStatus,
  PreferredLanguage,
  UserRole,
} from '../../src/shared/enums';

let phoneCounter = 100000;
function uniquePhone(): string {
  phoneCounter += 1;
  return `+96650${phoneCounter}`;
}

export async function makeAuthenticatedUser(
  app: INestApplication,
  overrides: Partial<User> = {},
): Promise<{ user: User; token: string }> {
  const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
  const jwtService = app.get(JwtService);

  const user = await userRepo.save(
    userRepo.create({
      role: UserRole.BUYER,
      fullName: 'Test User',
      phone: uniquePhone(),
      email: null,
      country: 'SA',
      city: 'Riyadh',
      kycStatus: KycStatus.VERIFIED,
      kycDocuments: null,
      preferredLanguage: PreferredLanguage.AR,
      ...overrides,
    }),
  );

  const token = jwtService.sign(
    { sub: user.id, phone: user.phone, role: user.role },
    { secret: process.env.JWT_SECRET },
  );
  return { user, token };
}

export async function createListing(
  app: INestApplication,
  seller: User,
  overrides: Partial<Listing> = {},
): Promise<Listing> {
  const listingRepo = app.get<Repository<Listing>>(getRepositoryToken(Listing));
  return listingRepo.save(
    listingRepo.create({
      sellerId: seller.id,
      title: 'Test Listing',
      breed: Breed.AWASSI,
      quantity: 50,
      ageMonths: 12,
      weightKg: 45,
      pricePerHead: 1200,
      currency: Currency.SAR,
      originCountry: 'SY',
      originCity: 'Damascus',
      description: 'Healthy sheep',
      images: ['listings/test/img-1.jpg'],
      videoUrl: null,
      healthStatus: HealthStatus.UNCHECKED,
      certificateId: null,
      status: ListingStatus.ACTIVE,
      ...overrides,
    }),
  );
}

export async function createOrder(
  app: INestApplication,
  buyer: User,
  seller: User,
  listing: Listing,
  overrides: Partial<Order> = {},
): Promise<Order> {
  const orderRepo = app.get<Repository<Order>>(getRepositoryToken(Order));
  const quantity = 10;
  const unitPrice = 1150;
  const totalPrice = quantity * unitPrice;
  return orderRepo.save(
    orderRepo.create({
      listingId: listing.id,
      buyerId: buyer.id,
      sellerId: seller.id,
      brokerId: null,
      quantity,
      unitPrice,
      currency: Currency.SAR,
      totalPrice,
      commissionRate: 5,
      commissionAmount: totalPrice * 0.05,
      status: OrderStatus.PENDING,
      deliveryCountry: 'SA',
      deliveryCity: 'Riyadh',
      deliveryAddress: '123 Test St',
      ...overrides,
    }),
  );
}

export async function createAcceptedOrder(
  app: INestApplication,
  buyer: User,
  seller: User,
  listingOverrides: Partial<Listing> = {},
  orderOverrides: Partial<Order> = {},
): Promise<{ listing: Listing; order: Order }> {
  const listing = await createListing(app, seller, listingOverrides);
  const order = await createOrder(app, buyer, seller, listing, {
    status: OrderStatus.ACCEPTED,
    ...orderOverrides,
  });
  return { listing, order };
}

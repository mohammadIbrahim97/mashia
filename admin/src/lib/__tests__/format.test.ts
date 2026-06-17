import {
  fmtDate,
  fmtMoney,
  reviewKind,
  reviewLabel,
  orderStatusKind,
  orderStatusLabel,
  escrowStatusKind,
  escrowStatusLabel,
  listingStatusKind,
  listingStatusLabel,
} from '../format';

describe('format utilities', () => {
  describe('fmtDate', () => {
    it('returns "—" for null or undefined', () => {
      expect(fmtDate(null)).toBe('—');
      expect(fmtDate(undefined)).toBe('—');
      expect(fmtDate('')).toBe('—');
    });

    it('returns the original string if the date is invalid', () => {
      expect(fmtDate('invalid-date')).toBe('invalid-date');
    });

    it('formats a valid date string correctly', () => {
      const dateString = '2023-10-05T14:48:00.000Z';
      const formatted = fmtDate(dateString);
      // Depending on the local timezone of the test runner, it could be Oct 5, 2023.
      // We check that it contains the expected parts.
      expect(formatted).toMatch(/Oct [456], 2023/);
    });
  });

  describe('fmtMoney', () => {
    it('formats money correctly', () => {
      expect(fmtMoney(1234.5, 'USD')).toBe('USD 1,234.5');
      expect(fmtMoney(1000, 'EUR')).toBe('EUR 1,000');
    });
  });

  describe('review helpers', () => {
    it('reviewKind returns correct badge kind', () => {
      expect(reviewKind('verified')).toBe('verified');
      expect(reviewKind('pending')).toBe('pending');
      expect(reviewKind('rejected')).toBe('flagged');
    });

    it('reviewLabel capitalizes status', () => {
      expect(reviewLabel('verified')).toBe('Verified');
      expect(reviewLabel('pending')).toBe('Pending');
      expect(reviewLabel('rejected')).toBe('Rejected');
    });
  });

  describe('order status helpers', () => {
    it('orderStatusKind returns correct badge kind', () => {
      expect(orderStatusKind('pending')).toBe('pending');
      expect(orderStatusKind('completed')).toBe('verified');
      expect(orderStatusKind('cancelled')).toBe('neutral');
    });

    it('orderStatusLabel returns correct label', () => {
      expect(orderStatusLabel('pending')).toBe('Pending');
      expect(orderStatusLabel('in_transit')).toBe('In transit');
    });
  });

  describe('escrow status helpers', () => {
    it('escrowStatusKind returns correct badge kind', () => {
      expect(escrowStatusKind('held')).toBe('pending');
      expect(escrowStatusKind('released')).toBe('verified');
      expect(escrowStatusKind('refunded')).toBe('neutral');
    });

    it('escrowStatusLabel returns correct label', () => {
      expect(escrowStatusLabel('held')).toBe('Held');
      expect(escrowStatusLabel('released')).toBe('Released');
      expect(escrowStatusLabel('refunded')).toBe('Refunded');
    });
  });

  describe('listing status helpers', () => {
    it('listingStatusKind returns correct badge kind', () => {
      expect(listingStatusKind('active')).toBe('verified');
      expect(listingStatusKind('sold')).toBe('neutral');
      expect(listingStatusKind('expired')).toBe('neutral');
      expect(listingStatusKind('flagged')).toBe('flagged');
    });

    it('listingStatusLabel returns correct label', () => {
      expect(listingStatusLabel('active')).toBe('Active');
      expect(listingStatusLabel('sold')).toBe('Sold');
    });
  });
});

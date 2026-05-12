import { BadgeKind } from '@/components/ui/Badge';

export type ReviewStatus = 'pending' | 'verified' | 'rejected';

export function reviewKind(s: ReviewStatus): BadgeKind {
  if (s === 'verified') return 'verified';
  if (s === 'pending') return 'pending';
  return 'flagged';
}

export function reviewLabel(s: ReviewStatus): string {
  return s[0].toUpperCase() + s.slice(1);
}

export function fmtDate(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'paid'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'disputed'
  | 'cancelled';

const ORDER_STATUS_KIND: Record<OrderStatus, BadgeKind> = {
  pending: 'pending',
  accepted: 'info',
  paid: 'info',
  in_transit: 'info',
  delivered: 'info',
  completed: 'verified',
  disputed: 'flagged',
  cancelled: 'neutral',
};

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  paid: 'Paid',
  in_transit: 'In transit',
  delivered: 'Delivered',
  completed: 'Completed',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
};

export const orderStatusKind = (s: OrderStatus) => ORDER_STATUS_KIND[s];
export const orderStatusLabel = (s: OrderStatus) => ORDER_STATUS_LABEL[s];

export function fmtMoney(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency} ${formatted}`;
}

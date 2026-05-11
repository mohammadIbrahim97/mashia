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

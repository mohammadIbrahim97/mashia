'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Overline } from '@/components/ui/Overline';
import {
  AdminOrderList,
  AdminOrderListItem,
  OrderStatus,
  ordersService,
} from '@/services/orders.service';
import { errorMessage } from '@/services/api';
import { fmtDate, fmtMoney, orderStatusKind, orderStatusLabel } from '@/lib/format';

type Tab = 'disputed' | 'active' | 'pending' | 'done' | 'all';
const TABS: { id: Tab; label: string; statuses: OrderStatus[] }[] = [
  { id: 'disputed', label: 'Disputed', statuses: ['disputed'] },
  {
    id: 'active',
    label: 'Active',
    statuses: ['paid', 'in_transit', 'delivered'],
  },
  { id: 'pending', label: 'Pending', statuses: ['pending', 'accepted'] },
  { id: 'done', label: 'Done', statuses: ['completed', 'cancelled'] },
  { id: 'all', label: 'All', statuses: [] },
];

const PAGE_SIZE = 20;
const COL_TEMPLATE =
  'grid grid-cols-[1fr_1fr_1.4fr_140px_120px_120px]';

export default function AdminOrdersPage() {
  const [tab, setTab] = useState<Tab>('disputed');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<AdminOrderList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onTabClick = (t: Tab) => {
    if (t === tab) return;
    setTab(t);
    setPage(1);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const tabDef = TABS.find((t) => t.id === tab)!;
    const query: Parameters<typeof ordersService.list>[0] = {
      page,
      pageSize: PAGE_SIZE,
    };
    if (tabDef.statuses.length > 0) query.status = tabDef.statuses;
    ordersService
      .list(query)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load orders.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, page]);

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="p-8">
      <div className="mb-5">
        <Overline>● G3-US06 · ORDERS &amp; DISPUTES</Overline>
        <h1 className="font-display text-[28px] font-medium tracking-tight mt-1 text-ink">
          Orders
        </h1>
        <div className="text-[13px] text-muted mt-1">
          Inspect any order on the platform. Resolve disputes by releasing
          escrow to the seller or refunding the buyer.
        </div>
      </div>

      <div className="flex border-b border-hairline mb-4">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTabClick(t.id)}
              className={`px-4 py-2.5 font-body text-[13px] -mb-px border-b-2 transition-colors ${
                active
                  ? 'text-ink font-semibold border-mashia-600'
                  : 'text-muted border-transparent hover:text-ink'
              }`}
            >
              {t.label}
              {data && tab === t.id && (
                <span className="ml-2 font-mono text-[10px] text-mashia-700 bg-mashia-50 px-1.5 py-px rounded-full font-semibold">
                  {data.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-paper border border-hairline rounded-md overflow-hidden">
        <div
          className={`${COL_TEMPLATE} px-5 py-3 border-b border-hairline bg-parchment`}
        >
          {['Buyer', 'Seller', 'Listing', 'Total', 'Status', 'Created'].map(
            (h) => (
              <div
                key={h}
                className="font-mono text-[10px] tracking-mono-wide uppercase text-muted font-semibold"
              >
                {h}
              </div>
            ),
          )}
        </div>
        <OrdersTableBody
          loading={loading}
          error={error}
          items={data?.items ?? []}
        />
      </div>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 font-mono text-[11px] text-muted">
          <span>
            Page {page} of {totalPages} · {data.total} orders
          </span>
          <div className="flex gap-2">
            <Button
              kind="secondary"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Prev
            </Button>
            <Button
              kind="secondary"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersTableBody({
  loading,
  error,
  items,
}: {
  loading: boolean;
  error: string | null;
  items: AdminOrderListItem[];
}) {
  if (loading) {
    return (
      <div className="px-5 py-12 text-center text-muted text-[13px]">
        Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-5 py-12 text-center text-flagged text-[13px]">
        {error}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-muted text-[13px]">
        No orders in this queue.
      </div>
    );
  }
  return (
    <>
      {items.map((o, i) => (
        <Link
          key={o.id}
          href={`/orders/${o.id}`}
          className={`${COL_TEMPLATE} px-5 py-3.5 items-center text-[13px] cursor-pointer hover:bg-parchment/70 ${
            i ? 'border-t border-hairline' : ''
          }`}
        >
          <div className="text-ink truncate pr-3">{o.buyerName ?? '—'}</div>
          <div className="text-ink truncate pr-3">{o.sellerName ?? '—'}</div>
          <div className="text-muted truncate pr-3">
            {o.listingTitle ?? <span className="italic">(deleted)</span>}
          </div>
          <div className="text-ink font-mono text-[12px]">
            {fmtMoney(o.totalPrice, o.currency)}
          </div>
          <div>
            <Badge kind={orderStatusKind(o.status)}>
              {orderStatusLabel(o.status)}
            </Badge>
          </div>
          <div className="font-mono text-[11px] text-muted">
            {fmtDate(o.createdAt)}
          </div>
        </Link>
      ))}
    </>
  );
}

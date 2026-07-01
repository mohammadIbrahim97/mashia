'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Overline } from '@/components/ui/Overline';
import {
  AdminListingList,
  AdminListingListItem,
  Breed,
  ListingStatus,
  listingsService,
} from '@/services/listings.service';
import { errorMessage } from '@/services/api';
import {
  fmtDate,
  fmtMoney,
  listingStatusKind,
  listingStatusLabel,
} from '@/lib/format';

type Tab = 'flagged' | 'active' | 'sold' | 'all';
const TABS: { id: Tab; label: string; status?: ListingStatus }[] = [
  { id: 'flagged', label: 'Flagged', status: 'flagged' },
  { id: 'active', label: 'Active', status: 'active' },
  { id: 'sold', label: 'Sold', status: 'sold' },
  { id: 'all', label: 'All' },
];

const BREEDS: { value: Breed | 'all'; label: string }[] = [
  { value: 'all', label: 'All breeds' },
  { value: 'awassi', label: 'Awassi' },
  { value: 'najdi', label: 'Najdi' },
  { value: 'arabi', label: 'Arabi' },
  { value: 'shami', label: 'Shami' },
  { value: 'other', label: 'Other' },
];

const PAGE_SIZE = 20;
const COL_TEMPLATE =
  'grid grid-cols-[1.6fr_100px_1.2fr_120px_100px_120px]';

export default function AdminListingsPage() {
  const [tab, setTab] = useState<Tab>('flagged');
  const [breed, setBreed] = useState<Breed | 'all'>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<AdminListingList | null>(null);
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
    const query: Parameters<typeof listingsService.list>[0] = {
      page,
      pageSize: PAGE_SIZE,
    };
    if (tabDef.status) query.status = tabDef.status;
    if (breed !== 'all') query.breed = breed;
    if (q.trim()) query.q = q.trim();

    const t = setTimeout(() => {
      listingsService
        .list(query)
        .then((res) => {
          if (!cancelled) setData(res);
        })
        .catch((err) => {
          if (!cancelled)
            setError(errorMessage(err, 'Could not load listings.'));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [tab, breed, q, page]);

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / PAGE_SIZE))
    : 1;

  return (
    <div className="p-8">
      <div className="mb-5">
        <Overline>● G3-US04 · LISTINGS MODERATION</Overline>
        <h1 className="font-display text-[28px] font-medium tracking-tight mt-1 text-ink">
          Listings
        </h1>
        <div className="text-[13px] text-muted mt-1">
          Review listings, flag suspicious ones, or remove violations.
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

      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          aria-label="Search listings"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search title or seller…"
          className="flex-1 min-w-[280px] px-3 py-2 bg-paper border border-hairline rounded-md font-body text-[13px] outline-none focus:border-mashia-600"
        />
        <select
          aria-label="Filter by breed"
          value={breed}
          onChange={(e) => {
            setBreed(e.target.value as Breed | 'all');
            setPage(1);
          }}
          className="px-3 py-2 bg-paper border border-hairline rounded-md font-body text-[13px] outline-none focus:border-mashia-600"
        >
          {BREEDS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-paper border border-hairline rounded-md overflow-hidden">
        <div
          className={`${COL_TEMPLATE} px-5 py-3 border-b border-hairline bg-parchment`}
        >
          {['Title', 'Breed', 'Seller', 'Price/head', 'Status', 'Created'].map(
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
        <ListingsTableBody
          loading={loading}
          error={error}
          items={data?.items ?? []}
        />
      </div>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 font-mono text-[11px] text-muted">
          <span>
            Page {page} of {totalPages} · {data.total} listings
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

function ListingsTableBody({
  loading,
  error,
  items,
}: {
  loading: boolean;
  error: string | null;
  items: AdminListingListItem[];
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
        No listings in this queue.
      </div>
    );
  }
  return (
    <>
      {items.map((l, i) => (
        <Link
          key={l.id}
          href={`/listings/${l.id}`}
          className={`${COL_TEMPLATE} px-5 py-3.5 items-center text-[13px] cursor-pointer hover:bg-parchment/70 ${
            i ? 'border-t border-hairline' : ''
          }`}
        >
          <div className="text-ink font-medium truncate pr-3">
            {l.title}
            <div className="text-muted text-[11px] font-normal truncate">
              {l.originCity}, {l.originCountry} · {l.quantity} head
            </div>
          </div>
          <div className="text-muted capitalize">{l.breed}</div>
          <div className="text-ink truncate pr-3">{l.sellerName ?? '—'}</div>
          <div className="text-ink font-mono text-[12px]">
            {fmtMoney(l.pricePerHead, l.currency)}
          </div>
          <div>
            <Badge kind={listingStatusKind(l.status)}>
              {listingStatusLabel(l.status)}
            </Badge>
          </div>
          <div className="font-mono text-[11px] text-muted">
            {fmtDate(l.createdAt)}
          </div>
        </Link>
      ))}
    </>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Overline } from '@/components/ui/Overline';
import {
  AdminCertificateList,
  certificatesService,
} from '@/services/certificates.service';
import { errorMessage } from '@/services/api';
import { fmtDate, reviewKind, reviewLabel } from '@/lib/format';

type Tab = 'pending' | 'verified' | 'rejected' | 'all';
const TABS: { id: Tab; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'verified', label: 'Verified' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

const TYPE_LABEL: Record<string, string> = {
  vaccination: 'Vaccination',
  health: 'Health',
  origin: 'Origin',
};

export default function AdminCertificatesPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [data, setData] = useState<AdminCertificateList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    certificatesService
      .list({ status: tab })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load certificates.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  return (
    <div className="p-8">
      <div className="mb-5">
        <Overline>● G3-US05 · CERTIFICATE QUEUE</Overline>
        <h1 className="font-display text-[28px] font-medium tracking-tight mt-1 text-ink">
          Veterinary certificates
        </h1>
        <div className="text-[13px] text-muted mt-1">
          Review and verify certificates uploaded by sellers. Approving sets the
          listing&apos;s health status to <em>certified</em>.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-hairline mb-4">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
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

      {/* Table */}
      <div className="bg-paper border border-hairline rounded-md overflow-hidden">
        <div className="grid grid-cols-[1.2fr_140px_1.8fr_1.2fr_120px_120px] px-5 py-3 border-b border-hairline bg-parchment">
          {['Issuer', 'Type', 'Linked listing', 'Seller', 'Status', 'Submitted'].map(
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
        {loading ? (
          <div className="px-5 py-12 text-center text-muted text-[13px]">
            Loading…
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-center text-flagged text-[13px]">
            {error}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="px-5 py-12 text-center text-muted text-[13px]">
            No certificates in this queue.
          </div>
        ) : (
          data.items.map((c, i) => (
            <Link
              key={c.id}
              href={`/certificates/${c.id}`}
              className={`grid grid-cols-[1.2fr_140px_1.8fr_1.2fr_120px_120px] px-5 py-3.5 items-center text-[13px] cursor-pointer hover:bg-parchment/70 ${
                i ? 'border-t border-hairline' : ''
              }`}
            >
              <div className="text-ink font-medium truncate pr-3">
                {c.issuingAuthority}
              </div>
              <div className="text-muted">{TYPE_LABEL[c.type] ?? c.type}</div>
              <div className="text-ink truncate pr-3">
                {c.listingTitle ?? (
                  <span className="text-muted italic">(unlinked)</span>
                )}
              </div>
              <div className="text-muted truncate pr-3">{c.sellerName ?? '—'}</div>
              <div>
                <Badge kind={reviewKind(c.status)}>{reviewLabel(c.status)}</Badge>
              </div>
              <div className="font-mono text-[11px] text-muted">
                {fmtDate(c.createdAt)}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, BadgeKind } from '@/components/ui/Badge';
import { Overline } from '@/components/ui/Overline';
import {
  AdminUserList,
  KycStatus,
  Role,
  usersService,
} from '@/services/users.service';
import { errorMessage } from '@/services/api';

type Tab = 'pending' | 'verified' | 'rejected' | 'all';
const TABS: { id: Tab; label: string }[] = [
  { id: 'pending', label: 'Pending KYC' },
  { id: 'verified', label: 'Verified' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

const ROLE_LABEL: Record<Role, string> = {
  seller: 'Seller',
  buyer: 'Buyer',
  broker: 'Broker',
  admin: 'Admin',
};

function kycKind(s: KycStatus): BadgeKind {
  if (s === 'verified') return 'verified';
  if (s === 'pending') return 'pending';
  return 'flagged';
}

function fmt(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AdminUsersPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [role, setRole] = useState<Role | 'all'>('all');
  const [q, setQ] = useState('');
  const [data, setData] = useState<AdminUserList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const query: Parameters<typeof usersService.list>[0] = {};
    if (tab !== 'all') query.kycStatus = tab;
    if (role !== 'all') query.role = role;
    if (q.trim()) query.q = q.trim();
    usersService
      .list(query)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load users.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, role, q]);

  return (
    <div className="p-8">
      <div className="mb-5">
        <Overline>● G3-US03 · USERS &amp; KYC REVIEW</Overline>
        <h1 className="font-display text-[28px] font-medium tracking-tight mt-1 text-ink">
          Users
        </h1>
        <div className="text-[13px] text-muted mt-1">
          Review traders, verify KYC submissions, and suspend bad actors.
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

      {/* Filter bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, or email…"
          className="flex-1 min-w-[280px] px-3 py-2 bg-paper border border-hairline rounded-md font-body text-[13px] outline-none focus:border-mashia-600"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role | 'all')}
          className="px-3 py-2 bg-paper border border-hairline rounded-md font-body text-[13px] outline-none focus:border-mashia-600"
        >
          <option value="all">All roles</option>
          <option value="seller">Sellers</option>
          <option value="buyer">Buyers</option>
          <option value="broker">Brokers</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-paper border border-hairline rounded-md overflow-hidden">
        <div className="grid grid-cols-[1.5fr_160px_100px_120px_120px_100px_120px] px-5 py-3 border-b border-hairline bg-parchment">
          {['Name', 'Phone', 'Role', 'Country', 'KYC', 'Status', 'Joined'].map(
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
            No users in this queue.
          </div>
        ) : (
          data.items.map((u, i) => (
            <Link
              key={u.id}
              href={`/users/${u.id}`}
              className={`grid grid-cols-[1.5fr_160px_100px_120px_120px_100px_120px] px-5 py-3.5 items-center text-[13px] cursor-pointer hover:bg-parchment/70 ${
                i ? 'border-t border-hairline' : ''
              }`}
            >
              <div className="text-ink font-medium truncate pr-3">
                {u.fullName}
                {u.email && (
                  <div className="text-muted text-[11px] font-normal truncate">
                    {u.email}
                  </div>
                )}
              </div>
              <div className="text-muted font-mono text-[12px]">{u.phone}</div>
              <div className="text-muted">{ROLE_LABEL[u.role]}</div>
              <div className="text-muted font-mono text-[12px]">{u.country}</div>
              <div>
                <Badge kind={kycKind(u.kycStatus)}>
                  {u.kycStatus[0].toUpperCase() + u.kycStatus.slice(1)}
                </Badge>
              </div>
              <div>
                {u.suspended ? (
                  <Badge kind="flagged">Suspended</Badge>
                ) : (
                  <span className="text-muted text-[12px]">—</span>
                )}
              </div>
              <div className="font-mono text-[11px] text-muted">
                {fmt(u.createdAt)}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

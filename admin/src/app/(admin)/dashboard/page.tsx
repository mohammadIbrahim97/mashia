'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Overline } from '@/components/ui/Overline';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { adminService, DashboardActivityItem, DashboardKpis } from '@/services/admin.service';
import { errorMessage } from '@/services/api';

function formatTime(ts: string): string {
  const dt = new Date(ts);
  return Number.isNaN(dt.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(dt);
}

function formatMoney(value: number, currency: string): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(safeValue);
  } catch {
    return `${safeValue.toLocaleString()} ${currency}`;
  }
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [activity, setActivity] = useState<DashboardActivityItem[]>([]);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [kpisError, setKpisError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoadingKpis(true);
        setKpisError(null);
        const data = await adminService.getDashboard();
        if (!mounted) return;
        setKpis(data.kpis);
        setActivity(data.activity ?? []);
      } catch (err) {
        if (!mounted) return;
        setKpisError(errorMessage(err, 'Could not load dashboard KPIs.'));
      } finally {
        if (mounted) setLoadingKpis(false);
      }

      try {
        setLoadingActivity(true);
        setActivityError(null);
        const recent = await adminService.getRecentActivity(10);
        if (!mounted) return;
        setActivity(recent);
      } catch (err) {
        if (!mounted) return;
        setActivityError(errorMessage(err, 'Could not load recent activity.'));
      } finally {
        if (mounted) setLoadingActivity(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const runtimeStamp = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(new Date()),
    [],
  );

  return (
    <div className="p-8">
      <div className="flex justify-between items-baseline mb-5">
        <div>
          <Overline>● OVERVIEW · LIVE</Overline>
          <h1 className="font-display text-[28px] font-medium tracking-tight mt-1 text-ink">Mashia at a glance</h1>
          <div className="text-[13px] text-muted mt-1">Auto-refreshes every 60 s · runtime locale · {runtimeStamp}</div>
        </div>
        <div className="flex gap-2">
          <Button kind="secondary" size="sm">Export report</Button>
          <Button size="sm">Custom range</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3.5 mb-3.5">
        <KpiCard label="Total users" value={loadingKpis ? '—' : (kpis?.totalUsers ?? 0).toLocaleString()} hint={loadingKpis ? 'Loading…' : undefined} tone="accent" />
        <KpiCard label="Active listings" value={loadingKpis ? '—' : (kpis?.activeListings ?? 0).toLocaleString()} hint={loadingKpis ? 'Loading…' : undefined} tone="accent" />
        <KpiCard label="Active orders" value={loadingKpis ? '—' : (kpis?.activeOrders ?? 0).toLocaleString()} hint={loadingKpis ? 'Loading…' : undefined} tone="accent" />
        <KpiCard label="Revenue · MTD" value={loadingKpis ? '—' : (kpis?.revenueMtd ?? 0).toLocaleString()} unit={kpis?.revenueCurrency ?? 'SAR'} hint={loadingKpis ? 'Loading…' : 'commission held'} tone="accent" />
      </div>

      <div className="grid grid-cols-4 gap-3.5 mb-6">
        <Link href="/users" className="contents"><KpiCard label="KYC pending" value={loadingKpis ? '—' : kpis?.usersPendingKyc ?? 0} hint={kpisError ?? undefined} tone="warn" onClick={() => {}} /></Link>
        <Link href="/certificates" className="contents"><KpiCard label="Certs pending" value={loadingKpis ? '—' : kpis?.certsPending ?? 0} hint={kpisError ?? undefined} tone="warn" onClick={() => {}} /></Link>
        <Link href="/orders" className="contents"><KpiCard label="Open disputes" value={loadingKpis ? '—' : kpis?.disputedOrders ?? 0} hint={kpisError ?? undefined} tone="danger" onClick={() => {}} /></Link>
        <KpiCard label="Avg. release" value={loadingKpis ? '—' : kpis?.avgReleaseDays ?? 0} unit="DAYS" hint={kpisError ?? undefined} tone="neutral" />
      </div>

      <RevenueSection kpis={kpis} loading={loadingKpis} error={kpisError} />

      <div className="grid grid-cols-[1.6fr_1fr] gap-4">
        <Card kicker="● RECENT ACTIVITY" title="Last 24 hours" action={<Button kind="ghost" size="sm">Open audit log →</Button>} padding={0}>
          {loadingActivity && <div className="px-5 py-4"><LoadingState label="Loading activity…" /></div>}
          {!loadingActivity && activityError && <div className="px-5 py-4 text-sm text-flagged">{activityError}</div>}
          {!loadingActivity && !activityError && activity.length === 0 && <div className="px-5 py-4 text-sm text-muted">No recent activity.</div>}
          {!loadingActivity && !activityError && activity.map((r, i) => {
            const inner = (
              <div className={`grid grid-cols-[64px_90px_1fr_auto] gap-x-4 px-5 py-3 items-center text-[13px] ${i ? 'border-t border-hairline' : ''} ${r.href ? 'cursor-pointer hover:bg-parchment' : ''}`}>
                <div className="font-mono text-[11px] text-muted">{formatTime(r.timestamp)}</div>
                <div><Badge kind={r.kind}>{r.tag}</Badge></div>
                <div>{r.text}</div>
                {r.href && <span className="text-muted text-sm">→</span>}
              </div>
            );
            return r.href ? <Link key={r.id} href={r.href} className="block">{inner}</Link> : <div key={r.id}>{inner}</div>;
          })}
        </Card>

        <div className="flex flex-col gap-4">
          <Card kicker="● ATTENTION QUEUES" title="What needs you" padding={0}>
            {loadingKpis && <div className="px-5 py-4"><LoadingState label="Loading queues…" /></div>}
            {!loadingKpis && kpisError && <div className="px-5 py-4 text-sm text-flagged">{kpisError}</div>}
            {!loadingKpis && !kpisError && (
              <>
                {[
                  { label: 'KYC review', count: kpis?.usersPendingKyc ?? 0, tone: 'warn', href: '/users' },
                  { label: 'Vet certs', count: kpis?.certsPending ?? 0, tone: 'warn', href: '/certificates' },
                  { label: 'Flagged listings', count: kpis?.flaggedListings ?? 0, tone: 'danger', href: '/listings' },
                  { label: 'Disputed orders', count: kpis?.disputedOrders ?? 0, tone: 'danger', href: '/orders' },
                ].map((q, i) => (
                  <Link key={q.label} href={q.href} className="block">
                    <div className={`flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-parchment ${i ? 'border-t border-hairline' : ''}`}>
                      <div className="flex items-center gap-2.5"><span className={`w-1.5 h-1.5 rounded-full ${q.tone === 'danger' ? 'bg-flagged' : 'bg-gold'}`} /><span className="text-[13px] font-medium text-ink">{q.label}</span></div>
                      <div className="flex items-center gap-2.5"><span className="font-display text-[22px] font-medium text-ink">{q.count}</span><span className="text-muted">→</span></div>
                    </div>
                  </Link>
                ))}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function RevenueSection({
  kpis,
  loading,
  error,
}: {
  kpis: DashboardKpis | null;
  loading: boolean;
  error: string | null;
}) {
  const rows = kpis?.revenueByCurrency ?? [];
  const fallbackCurrencies = ['SAR', 'SYP', 'TRY'];
  const selectableCurrencies = rows.length
    ? rows.map((row) => row.currency)
    : fallbackCurrencies;
  const defaultCurrency = (kpis?.revenueCurrency && selectableCurrencies.includes(kpis.revenueCurrency))
    ? kpis.revenueCurrency
    : selectableCurrencies[0];
  const [selectedCurrency, setSelectedCurrency] = useState(defaultCurrency);

  useEffect(() => {
    setSelectedCurrency(defaultCurrency);
  }, [defaultCurrency]);

  const selected = rows.find((row) => row.currency === selectedCurrency);
  const totalRevenue = selected?.totalRevenue ?? 0;
  const revenueMtd = selected?.revenueMtd ?? 0;

  const onCurrencyChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedCurrency(event.target.value);
  };

  return (
    <Card
      kicker="● REVENUE"
      title="Commission by currency"
      action={
        <Link
          href="/payments"
          className="font-body font-semibold text-xs text-mashia-600 hover:bg-mashia-50 rounded-md px-3 py-1.5"
        >
          Open payments →
        </Link>
      }
      padding={0}
      className="mb-6"
    >
      {loading && <div className="px-5 py-4"><LoadingState label="Loading revenue…" /></div>}
      {!loading && error && <div className="px-5 py-4 text-sm text-flagged">{error}</div>}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-[1fr_1fr_120px] gap-4 px-5 py-4 border-b border-hairline">
            <div>
              <div className="font-display text-[24px] font-medium text-ink">
                {formatMoney(revenueMtd, selectedCurrency)}
              </div>
              <div className="font-mono text-[10px] tracking-mono-wide uppercase text-muted mt-1">
                month to date
              </div>
            </div>
            <div>
              <div className="font-display text-[24px] font-medium text-ink">
                {formatMoney(totalRevenue, selectedCurrency)}
              </div>
              <div className="font-mono text-[10px] tracking-mono-wide uppercase text-muted mt-1">
                total tracked
              </div>
            </div>
            <div className="flex items-end justify-end">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] tracking-mono-wide uppercase text-muted">Currency</span>
                <select
                  value={selectedCurrency}
                  onChange={onCurrencyChange}
                  className="border border-hairline bg-white rounded-md px-2 py-1.5 text-[12px] text-ink"
                >
                  {selectableCurrencies.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="px-5 py-4 text-sm text-muted">No revenue recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[520px]">
                <div className="grid grid-cols-[120px_1fr_1fr] gap-4 px-5 py-2.5 font-mono text-[10px] tracking-mono-wide uppercase text-muted border-b border-hairline">
                  <div>Currency</div>
                  <div>MTD commission</div>
                  <div>Total commission</div>
                </div>
                {rows.map((row, i) => (
                  <div
                    key={row.currency}
                    className={`grid grid-cols-[120px_1fr_1fr] gap-4 px-5 py-3 text-[13px] items-center ${i ? 'border-t border-hairline' : ''}`}
                  >
                    <div className="font-mono text-[12px] text-ink">{row.currency}</div>
                    <div className="font-display text-[18px] font-medium text-ink">
                      {formatMoney(row.revenueMtd, row.currency)}
                    </div>
                    <div className="font-display text-[18px] font-medium text-ink">
                      {formatMoney(row.totalRevenue, row.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

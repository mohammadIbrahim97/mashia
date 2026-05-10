'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Overline } from '@/components/ui/Overline';
import { Badge, BadgeKind } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';

type Activity = {
  t: string;
  tag: string;
  text: React.ReactNode;
  kind: BadgeKind;
  href?: string;
};

const ACTIVITY: Activity[] = [
  {
    t: '14:02',
    tag: 'DISPUTE',
    text: (
      <>
        Buyer <b>#34</b> disputed order <b>ORD-2K7M-9F</b>
      </>
    ),
    kind: 'flagged',
    href: '/orders',
  },
  {
    t: '13:55',
    tag: 'CERT',
    text: (
      <>
        Seller <b>#12</b> uploaded health certificate (pending)
      </>
    ),
    kind: 'pending',
    href: '/certificates',
  },
  {
    t: '13:40',
    tag: 'KYC',
    text: (
      <>
        KYC submitted by <b>+966 50 ••• 4221</b>
      </>
    ),
    kind: 'pending',
    href: '/users',
  },
  {
    t: '13:18',
    tag: 'ORDER',
    text: (
      <>
        Escrow released — <b>ORD-2K7L-3A</b> · 8,800 USD
      </>
    ),
    kind: 'verified',
  },
  {
    t: '12:44',
    tag: 'LISTING',
    text: (
      <>
        Auto-flag · <b>SHP-DM-018</b> · vet cert expired
      </>
    ),
    kind: 'flagged',
    href: '/listings',
  },
  {
    t: '12:02',
    tag: 'KYC',
    text: <>Approved · Tarek Haddad · Damascus</>,
    kind: 'verified',
  },
  {
    t: '11:30',
    tag: 'PAYMENT',
    text: (
      <>
        Refund issued · 4,200 AED · ORD-2K7H-2D
      </>
    ),
    kind: 'info',
  },
];

const QUEUES: { label: string; count: number; tone: 'warn' | 'danger'; href: string }[] = [
  { label: 'KYC review', count: 23, tone: 'warn', href: '/users' },
  { label: 'Vet certs', count: 7, tone: 'warn', href: '/certificates' },
  { label: 'Flagged listings', count: 4, tone: 'danger', href: '/listings' },
  { label: 'Disputed orders', count: 2, tone: 'danger', href: '/orders' },
];

export default function DashboardPage() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-baseline mb-5">
        <div>
          <Overline>● OVERVIEW · LIVE</Overline>
          <h1 className="font-display text-[28px] font-medium tracking-tight mt-1 text-ink">
            Mashia at a glance
          </h1>
          <div className="text-[13px] text-muted mt-1">
            Auto-refreshes every 60 s · me-south-1 · Wed 10 May 2026, 14:02 AST
          </div>
        </div>
        <div className="flex gap-2">
          <Button kind="secondary" size="sm">
            Export report
          </Button>
          <Button size="sm">Custom range</Button>
        </div>
      </div>

      {/* 4-up accent KPIs */}
      <div className="grid grid-cols-4 gap-3.5 mb-3.5">
        <KpiCard label="Total users" value="1,247" hint="+38 this week" tone="accent" />
        <KpiCard
          label="Active listings"
          value="384"
          hint="of 1,284 lifetime"
          tone="accent"
        />
        <KpiCard
          label="Active orders"
          value="92"
          hint="142 in escrow"
          tone="accent"
        />
        <KpiCard
          label="Revenue · MTD"
          value="12,840"
          unit="SAR"
          hint="commission held"
          tone="accent"
        />
      </div>

      {/* 4-up attention KPIs */}
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        <Link href="/users" className="contents">
          <KpiCard
            label="KYC pending"
            value="23"
            hint="oldest: 3d ago"
            tone="warn"
            onClick={() => {}}
          />
        </Link>
        <Link href="/certificates" className="contents">
          <KpiCard
            label="Certs pending"
            value="7"
            hint="oldest: 2d ago"
            tone="warn"
            onClick={() => {}}
          />
        </Link>
        <Link href="/orders" className="contents">
          <KpiCard
            label="Open disputes"
            value="2"
            hint="needs admin action"
            tone="danger"
            onClick={() => {}}
          />
        </Link>
        <KpiCard
          label="Avg. release"
          value="5.4"
          unit="DAYS"
          hint="auto at 7d"
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] gap-4">
        {/* Recent activity */}
        <Card
          kicker="● RECENT ACTIVITY"
          title="Last 24 hours"
          action={
            <Button kind="ghost" size="sm">
              Open audit log →
            </Button>
          }
          padding={0}
        >
          {ACTIVITY.map((r, i) => {
            const inner = (
              <div
                className={`grid grid-cols-[64px_90px_1fr_auto] gap-x-4 px-5 py-3 items-center text-[13px] ${
                  i ? 'border-t border-hairline' : ''
                } ${r.href ? 'cursor-pointer hover:bg-parchment' : ''}`}
              >
                <div className="font-mono text-[11px] text-muted">{r.t}</div>
                <div>
                  <Badge kind={r.kind}>{r.tag}</Badge>
                </div>
                <div>{r.text}</div>
                {r.href && <span className="text-muted text-sm">→</span>}
              </div>
            );
            return r.href ? (
              <Link key={i} href={r.href} className="block">
                {inner}
              </Link>
            ) : (
              <div key={i}>{inner}</div>
            );
          })}
        </Card>

        {/* Right rail */}
        <div className="flex flex-col gap-4">
          <Card kicker="● ATTENTION QUEUES" title="What needs you" padding={0}>
            {QUEUES.map((q, i) => (
              <Link key={q.label} href={q.href} className="block">
                <div
                  className={`flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-parchment ${
                    i ? 'border-t border-hairline' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        q.tone === 'danger' ? 'bg-flagged' : 'bg-gold'
                      }`}
                    />
                    <span className="text-[13px] font-medium text-ink">
                      {q.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-display text-[22px] font-medium text-ink">
                      {q.count}
                    </span>
                    <span className="text-muted">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </Card>

          <Card
            kicker="● COMMISSION · 30D"
            title="91,420 SAR"
            action={<Badge kind="verified">+12%</Badge>}
          >
            <svg viewBox="0 0 320 80" width="100%" height="80" preserveAspectRatio="none">
              <path
                d="M0,60 L20,52 L40,58 L60,46 L80,50 L100,38 L120,42 L140,30 L160,34 L180,22 L200,28 L220,18 L240,22 L260,12 L280,16 L300,8 L320,12"
                fill="none"
                stroke="#007339"
                strokeWidth="1.5"
              />
            </svg>
            <div className="flex justify-between font-mono text-[10px] text-muted mt-1">
              <span>Apr 10</span>
              <span>Apr 25</span>
              <span>May 10</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

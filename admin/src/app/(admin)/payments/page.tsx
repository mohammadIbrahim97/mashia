"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Overline } from "@/components/ui/Overline";
import {
  AdminPaymentList,
  AdminPaymentListItem,
  PaymentMethod,
  paymentsService,
  RevenueSummary,
} from "@/services/payments.service";
import { errorMessage } from "@/services/api";
import {
  EscrowStatus,
  escrowStatusKind,
  escrowStatusLabel,
  fmtDate,
  fmtMoney,
} from "@/lib/format";

type Tab = "held" | "released" | "refunded" | "all";
const TABS: { id: Tab; label: string; status?: EscrowStatus }[] = [
  { id: "held", label: "Held", status: "held" },
  { id: "released", label: "Released", status: "released" },
  { id: "refunded", label: "Refunded", status: "refunded" },
  { id: "all", label: "All" },
];

const METHODS: { value: PaymentMethod | "all"; label: string }[] = [
  { value: "all", label: "All methods" },
  { value: "stc_pay", label: "STC Pay" },
  { value: "mada", label: "Mada" },
  { value: "bank_transfer", label: "Bank transfer" },
];

const PAGE_SIZE = 20;
const COL_TEMPLATE = "grid grid-cols-[120px_1fr_1fr_140px_140px_110px_120px]";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from: isoDate(from), to: isoDate(to) };
}

export default function AdminPaymentsPage() {
  const [tab, setTab] = useState<Tab>("held");
  const [method, setMethod] = useState<PaymentMethod | "all">("all");
  const initialRange = useMemo(defaultRange, []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<AdminPaymentList | null>(null);
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
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
    const listQuery: Parameters<typeof paymentsService.list>[0] = {
      page,
      pageSize: PAGE_SIZE,
      from: from || undefined,
      to: to || undefined,
    };
    if (tabDef.status) listQuery.escrowStatus = tabDef.status;
    if (method !== "all") listQuery.method = method;

    Promise.all([
      paymentsService.list(listQuery),
      paymentsService.revenue(from || undefined, to || undefined),
    ])
      .then(([list, rev]) => {
        if (cancelled) return;
        setData(list);
        setRevenue(rev);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "Could not load payments."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, method, from, to, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="p-8">
      <div className="mb-5">
        <Overline>● G3-US07 · PAYMENTS &amp; REVENUE</Overline>
        <h1 className="font-display text-[28px] font-medium tracking-tight mt-1 text-ink">
          Payments
        </h1>
        <div className="text-[13px] text-muted mt-1">
          Track every escrow movement and the commission Mashia has earned.
        </div>
      </div>

      <RevenueBanner
        revenue={revenue}
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
      />

      <div className="flex border-b border-hairline mb-4 mt-6">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTabClick(t.id)}
              className={`px-4 py-2.5 font-body text-[13px] -mb-px border-b-2 transition-colors ${
                active
                  ? "text-ink font-semibold border-mashia-600"
                  : "text-muted border-transparent hover:text-ink"
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
        <select
          value={method}
          onChange={(e) => {
            setMethod(e.target.value as PaymentMethod | "all");
            setPage(1);
          }}
          className="px-3 py-2 bg-paper border border-hairline rounded-md font-body text-[13px] outline-none focus:border-mashia-600"
        >
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-paper border border-hairline rounded-md overflow-hidden">
        <div
          className={`${COL_TEMPLATE} px-5 py-3 border-b border-hairline bg-parchment`}
        >
          {[
            "Buyer",
            "Seller",
            "Order",
            "Amount",
            "Commission",
            "Method",
            "Created",
          ].map((h) => (
            <div
              key={h}
              className="font-mono text-[10px] tracking-mono-wide uppercase text-muted font-semibold"
            >
              {h}
            </div>
          ))}
        </div>
        <PaymentsTableBody
          loading={loading}
          error={error}
          items={data?.items ?? []}
        />
      </div>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 font-mono text-[11px] text-muted">
          <span>
            Page {page} of {totalPages} · {data.total} payments
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

function RevenueBanner({
  revenue,
  from,
  to,
  onFrom,
  onTo,
}: {
  revenue: RevenueSummary | null;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <Card kicker="● COMMISSION EARNED" title="By currency × escrow state">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Overline>Range</Overline>
        <input
          type="date"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
          className="px-2 py-1.5 bg-parchment border border-hairline rounded font-mono text-[12px] outline-none focus:border-mashia-600"
        />
        <span className="text-muted text-[12px]">→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onTo(e.target.value)}
          className="px-2 py-1.5 bg-parchment border border-hairline rounded font-mono text-[12px] outline-none focus:border-mashia-600"
        />
      </div>
      {!revenue ? (
        <div className="text-muted text-[13px]">Loading commission…</div>
      ) : revenue.byCurrency.length === 0 ? (
        <div className="text-muted text-[13px]">No payments in this range.</div>
      ) : (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {revenue.byCurrency.map((c) => {
            const total =
              c.held.commission + c.released.commission + c.refunded.commission;
            return (
              <div
                key={c.currency}
                className="border border-hairline rounded-md p-4 bg-parchment"
              >
                <div className="font-display text-[22px] font-medium text-ink">
                  {fmtMoney(total, c.currency)}
                </div>
                <div className="font-mono text-[10px] tracking-mono-wide uppercase text-muted mt-1 mb-3">
                  total earned ({c.currency})
                </div>
                <dl className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5 text-[12px]">
                  <dt className="text-muted">Held</dt>
                  <dd className="text-ink font-mono">
                    {fmtMoney(c.held.commission, c.currency)} · {c.held.count}
                  </dd>
                  <dt className="text-muted">Released</dt>
                  <dd className="text-mashia-700 font-mono">
                    {fmtMoney(c.released.commission, c.currency)} ·{" "}
                    {c.released.count}
                  </dd>
                  <dt className="text-muted">Refunded</dt>
                  <dd className="text-ink font-mono">
                    {fmtMoney(c.refunded.commission, c.currency)} ·{" "}
                    {c.refunded.count}
                  </dd>
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function PaymentsTableBody({
  loading,
  error,
  items,
}: {
  loading: boolean;
  error: string | null;
  items: AdminPaymentListItem[];
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
        No payments in this range.
      </div>
    );
  }
  return (
    <>
      {items.map((p, i) => (
        <Link
          key={p.id}
          href={`/orders/${p.orderId}`}
          className={`${COL_TEMPLATE} px-5 py-3.5 items-center text-[13px] cursor-pointer hover:bg-parchment/70 ${
            i ? "border-t border-hairline" : ""
          }`}
        >
          <div className="text-ink truncate pr-3">{p.payerName ?? "—"}</div>
          <div className="text-ink truncate pr-3">{p.sellerName ?? "—"}</div>
          <div>
            <Badge kind={escrowStatusKind(p.escrowStatus)}>
              {escrowStatusLabel(p.escrowStatus)}
            </Badge>
          </div>
          <div className="text-ink font-mono text-[12px]">
            {fmtMoney(p.amount, p.currency)}
          </div>
          <div className="text-mashia-700 font-mono text-[12px]">
            {fmtMoney(p.commissionAmount, p.currency)}
          </div>
          <div className="text-muted font-mono text-[11px] uppercase">
            {p.method.replace(/_/g, " ")}
          </div>
          <div className="font-mono text-[11px] text-muted">
            {fmtDate(p.createdAt)}
          </div>
        </Link>
      ))}
    </>
  );
}

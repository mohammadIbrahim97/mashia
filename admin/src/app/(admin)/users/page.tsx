"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Overline } from "@/components/ui/Overline";
import {
  AdminUserList,
  AdminUserListItem,
  Role,
  usersService,
} from "@/services/users.service";
import { errorMessage } from "@/services/api";
import { fmtDate, reviewKind, reviewLabel } from "@/lib/format";

type Tab = "pending" | "verified" | "rejected" | "all";
const TABS: { id: Tab; label: string }[] = [
  { id: "pending", label: "Pending KYC" },
  { id: "verified", label: "Verified" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

const ROLE_LABEL: Record<Role, string> = {
  seller: "Seller",
  buyer: "Buyer",
  broker: "Broker",
  admin: "Admin",
};

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const COL_TEMPLATE =
  "grid grid-cols-[1.5fr_160px_100px_120px_120px_100px_120px]";

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function AdminUsersPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [role, setRole] = useState<Role | "all">("all");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<AdminUserList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onTabClick = (t: Tab) => {
    if (t === tab) return;
    setTab(t);
    setPage(1);
  };

  const onRoleChange = (r: Role | "all") => {
    if (r === role) return;
    setRole(r);
    setPage(1);
  };

  // Reset to page 1 when the debounced search query changes (typing settles).
  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const query: Parameters<typeof usersService.list>[0] = {
      page,
      pageSize: PAGE_SIZE,
    };
    if (tab !== "all") query.kycStatus = tab;
    if (role !== "all") query.role = role;
    if (debouncedQ.trim()) query.q = debouncedQ.trim();
    usersService
      .list(query)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "Could not load users."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, role, debouncedQ, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

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

      <div className="flex border-b border-hairline mb-4">
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
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, or email…"
          className="flex-1 min-w-[280px] px-3 py-2 bg-paper border border-hairline rounded-md font-body text-[13px] outline-none focus:border-mashia-600"
        />
        <select
          value={role}
          onChange={(e) => onRoleChange(e.target.value as Role | "all")}
          className="px-3 py-2 bg-paper border border-hairline rounded-md font-body text-[13px] outline-none focus:border-mashia-600"
        >
          <option value="all">All roles</option>
          <option value="seller">Sellers</option>
          <option value="buyer">Buyers</option>
          <option value="broker">Brokers</option>
        </select>
      </div>

      <div className="bg-paper border border-hairline rounded-md overflow-hidden">
        <div
          className={`${COL_TEMPLATE} px-5 py-3 border-b border-hairline bg-parchment`}
        >
          {["Name", "Phone", "Role", "Country", "KYC", "Status", "Joined"].map(
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
        <UsersTableBody
          loading={loading}
          error={error}
          items={data?.items ?? []}
        />
      </div>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 font-mono text-[11px] text-muted">
          <span>
            Page {page} of {totalPages} · {data.total} users
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

function UsersTableBody({
  loading,
  error,
  items,
}: {
  loading: boolean;
  error: string | null;
  items: AdminUserListItem[];
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
        No users in this queue.
      </div>
    );
  }
  return (
    <>
      {items.map((u, i) => (
        <Link
          key={u.id}
          href={`/users/${u.id}`}
          className={`${COL_TEMPLATE} px-5 py-3.5 items-center text-[13px] cursor-pointer hover:bg-parchment/70 ${
            i ? "border-t border-hairline" : ""
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
            <Badge kind={reviewKind(u.kycStatus)}>
              {reviewLabel(u.kycStatus)}
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
            {fmtDate(u.createdAt)}
          </div>
        </Link>
      ))}
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Overline } from "@/components/ui/Overline";
import {
  AdminOrderDetail,
  OrderStatus,
  ordersService,
} from "@/services/orders.service";
import { errorMessage } from "@/services/api";
import {
  escrowStatusKind,
  escrowStatusLabel,
  fmtDate,
  fmtMoney,
  orderStatusKind,
  orderStatusLabel,
} from "@/lib/format";

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "pending", label: "Order placed" },
  { status: "accepted", label: "Accepted by seller" },
  { status: "paid", label: "Payment held in escrow" },
  { status: "in_transit", label: "In transit" },
  { status: "delivered", label: "Delivered" },
  { status: "completed", label: "Completed (payment released)" },
];

type Dialog = "release" | "refund" | null;

export default function AdminOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();

  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    ordersService
      .getById(id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(errorMessage(err, "Could not load order."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const run = async (
    action: () => Promise<AdminOrderDetail>,
    errMsg: string,
  ) => {
    setBusy(true);
    setActionError(null);
    try {
      setDetail(await action());
    } catch (err) {
      setActionError(errorMessage(err, errMsg));
    } finally {
      setBusy(false);
      setDialog(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-muted text-[13px]">Loading…</div>
      </div>
    );
  }

  if (loadError || !detail) {
    return (
      <div className="p-8">
        <button
          onClick={() => router.push("/orders")}
          className="text-muted text-[13px] mb-4 hover:text-ink"
        >
          ← Back to orders
        </button>
        <div className="text-flagged text-[13px]">
          {loadError ?? "Order not found."}
        </div>
      </div>
    );
  }

  const { order, payment } = detail;
  const isDisputed = order.status === "disputed";
  const canResolve = isDisputed && payment?.escrowStatus === "held";

  const reachedIndex = STEPS.findIndex((s) => s.status === order.status);
  const isCancelledOrDisputed =
    order.status === "cancelled" || order.status === "disputed";

  return (
    <div className="p-8">
      <button
        onClick={() => router.push("/orders")}
        className="text-muted text-[13px] mb-4 hover:text-ink"
      >
        ← Back to orders
      </button>

      <div className="flex justify-between items-end gap-6 mb-6">
        <div>
          <Overline>● G3-US06 · ORDER</Overline>
          <h1 className="font-display text-[28px] font-medium tracking-tight mt-1 text-ink flex items-center gap-3">
            {fmtMoney(order.totalPrice, order.currency)} · {order.quantity} head
            <Badge kind={orderStatusKind(order.status)}>
              {orderStatusLabel(order.status)}
            </Badge>
          </h1>
          <div className="text-[13px] text-muted mt-1 font-mono">
            {order.id}
          </div>
        </div>
        {canResolve && (
          <div className="flex gap-2">
            <Button kind="danger" onClick={() => setDialog("refund")}>
              Refund buyer
            </Button>
            <Button onClick={() => setDialog("release")}>
              Release to seller →
            </Button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="mb-5 px-4 py-3 bg-[#F8E5E5] border border-[#EBC0C0] rounded-md text-[13px] text-[#8A2828]">
          {actionError}
        </div>
      )}

      {isDisputed && (
        <div className="mb-5 px-4 py-3 bg-[#F8E5E5] border border-[#EBC0C0] rounded-md">
          <Overline>Dispute open</Overline>
          <div className="text-[13px] text-[#8A2828] mt-1">
            Funds are held in escrow until you release them to the seller or
            refund the buyer.
          </div>
        </div>
      )}

      <div className="grid grid-cols-[1.4fr_1fr] gap-4">
        <div className="flex flex-col gap-4">
          <Card kicker="● TIMELINE" title="Order progression">
            <ol className="list-none m-0 p-0 flex flex-col gap-3">
              {STEPS.map((s, i) => {
                const done = !isCancelledOrDisputed && i < reachedIndex;
                const current = !isCancelledOrDisputed && i === reachedIndex;
                return (
                  <li
                    key={s.status}
                    className="grid grid-cols-[14px_1fr] gap-x-3.5 items-start"
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1 border-2 ${
                        done || current
                          ? "bg-mashia-600 border-mashia-600"
                          : "bg-parchment border-hairline"
                      }`}
                    />
                    <div
                      className={`text-[13px] ${
                        current
                          ? "font-semibold text-ink"
                          : done
                            ? "text-ink"
                            : "text-muted"
                      }`}
                    >
                      {s.label}
                    </div>
                  </li>
                );
              })}
              {isCancelledOrDisputed && (
                <li className="grid grid-cols-[14px_1fr] gap-x-3.5 items-start">
                  <div
                    className={`w-2.5 h-2.5 rounded-full mt-1 border-2 ${
                      order.status === "disputed"
                        ? "bg-flagged border-flagged"
                        : "bg-muted border-muted"
                    }`}
                  />
                  <div className="text-[13px] font-semibold text-ink">
                    {orderStatusLabel(order.status)}
                  </div>
                </li>
              )}
            </ol>
          </Card>

          <Card kicker="● PARTIES" title="Buyer & seller">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Overline>Buyer</Overline>
                <div className="mt-1 text-[13px] font-medium text-ink">
                  {order.buyer?.fullName ?? "—"}
                </div>
                <div className="text-muted font-mono text-[12px]">
                  {order.buyer?.phone ?? "—"}
                </div>
              </div>
              <div>
                <Overline>Seller</Overline>
                <div className="mt-1 text-[13px] font-medium text-ink">
                  {order.seller?.fullName ?? "—"}
                </div>
                <div className="text-muted font-mono text-[12px]">
                  {order.seller?.phone ?? "—"}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Overline>Delivery</Overline>
              <div className="mt-1 text-[13px] text-ink">
                {order.deliveryAddress}
              </div>
              <div className="text-muted text-[12px]">
                {order.deliveryCity}, {order.deliveryCountry}
              </div>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card kicker="● PAYMENT" title="Escrow status">
            {payment ? (
              <>
                <div className="flex items-center justify-between">
                  <Badge kind={escrowStatusKind(payment.escrowStatus)}>
                    {escrowStatusLabel(payment.escrowStatus)}
                  </Badge>
                  <span className="font-mono text-[11px] text-muted uppercase">
                    {payment.method}
                  </span>
                </div>
                <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-[13px] mt-4">
                  <dt className="text-muted">Total</dt>
                  <dd className="text-ink font-mono">
                    {fmtMoney(payment.amount, payment.currency)}
                  </dd>

                  <dt className="text-muted">Commission</dt>
                  <dd className="text-ink font-mono">
                    {fmtMoney(payment.commissionAmount, payment.currency)}
                  </dd>

                  <dt className="text-muted">To seller</dt>
                  <dd className="text-ink font-mono">
                    {fmtMoney(payment.sellerAmount, payment.currency)}
                  </dd>

                  {payment.releasedAt && (
                    <>
                      <dt className="text-muted">Released</dt>
                      <dd className="text-ink font-mono">
                        {fmtDate(payment.releasedAt)}
                      </dd>
                    </>
                  )}

                  {payment.refundedAt && (
                    <>
                      <dt className="text-muted">Refunded</dt>
                      <dd className="text-ink font-mono">
                        {fmtDate(payment.refundedAt)}
                      </dd>
                    </>
                  )}

                  {payment.autoReleaseAt && !payment.releasedAt && (
                    <>
                      <dt className="text-muted">Auto-release</dt>
                      <dd className="text-ink font-mono">
                        {fmtDate(payment.autoReleaseAt)}
                      </dd>
                    </>
                  )}
                </dl>
              </>
            ) : (
              <div className="text-muted text-[13px]">
                No payment recorded for this order yet.
              </div>
            )}
          </Card>

          <Card kicker="● LISTING" title="Origin">
            <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-[13px]">
              <dt className="text-muted">Title</dt>
              <dd className="text-ink">
                {order.listing?.title ?? (
                  <span className="italic text-muted">(deleted listing)</span>
                )}
              </dd>

              <dt className="text-muted">Quantity</dt>
              <dd className="text-ink">{order.quantity} head</dd>

              <dt className="text-muted">Unit price</dt>
              <dd className="text-ink font-mono">
                {fmtMoney(order.unitPrice, order.currency)}
              </dd>
            </dl>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === "release"}
        title="Release escrow to the seller?"
        body="You're siding with the seller. Funds will move from escrow to the seller's balance and the order will close as completed. This cannot be undone."
        confirmLabel="Release to seller"
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          run(() => ordersService.release(id), "Release failed.")
        }
      />

      <ConfirmDialog
        open={dialog === "refund"}
        title="Refund the buyer?"
        body="You're siding with the buyer. Funds will be refunded and the order will close as cancelled. This cannot be undone."
        confirmLabel="Refund buyer"
        danger
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() => run(() => ordersService.refund(id), "Refund failed.")}
      />
    </div>
  );
}

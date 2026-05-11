'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { Badge, BadgeKind } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Overline } from '@/components/ui/Overline';
import {
  AdminUserDetail,
  KycStatus,
  Role,
  usersService,
} from '@/services/users.service';
import { errorMessage } from '@/services/api';

const ROLE_LABEL: Record<Role, string> = {
  seller: 'Seller',
  buyer: 'Buyer',
  broker: 'Broker',
  admin: 'Admin',
};

const DOC_LABEL: Record<string, string> = {
  nationalId: 'National ID',
  selfie: 'Selfie',
  businessLicense: 'Business License',
};

function kycKind(s: KycStatus): BadgeKind {
  if (s === 'verified') return 'verified';
  if (s === 'pending') return 'pending';
  return 'flagged';
}

function fmt(date: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showSuspend, setShowSuspend] = useState(false);
  const [showUnsuspend, setShowUnsuspend] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    usersService
      .getById(id)
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load user.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const onApprove = async () => {
    setBusy(true);
    try {
      const updated = await usersService.reviewKyc(id, { decision: 'verified' });
      setUser(updated);
      setShowApprove(false);
    } catch (err) {
      setError(errorMessage(err, 'Approval failed.'));
      setShowApprove(false);
    } finally {
      setBusy(false);
    }
  };

  const onReject = async (reason?: string) => {
    if (!reason) return;
    setBusy(true);
    try {
      const updated = await usersService.reviewKyc(id, {
        decision: 'rejected',
        rejectionReason: reason,
      });
      setUser(updated);
      setShowReject(false);
    } catch (err) {
      setError(errorMessage(err, 'Rejection failed.'));
      setShowReject(false);
    } finally {
      setBusy(false);
    }
  };

  const onSuspend = async () => {
    setBusy(true);
    try {
      const updated = await usersService.suspend(id);
      setUser(updated);
      setShowSuspend(false);
    } catch (err) {
      setError(errorMessage(err, 'Suspend failed.'));
      setShowSuspend(false);
    } finally {
      setBusy(false);
    }
  };

  const onUnsuspend = async () => {
    setBusy(true);
    try {
      const updated = await usersService.unsuspend(id);
      setUser(updated);
      setShowUnsuspend(false);
    } catch (err) {
      setError(errorMessage(err, 'Unsuspend failed.'));
      setShowUnsuspend(false);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-muted text-[13px]">Loading…</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-8">
        <button
          onClick={() => router.push('/users')}
          className="text-muted text-[13px] mb-4 hover:text-ink"
        >
          ← Back to users
        </button>
        <div className="text-flagged text-[13px]">
          {error ?? 'User not found.'}
        </div>
      </div>
    );
  }

  const isPendingKyc = user.kycStatus === 'pending';
  const docEntries = user.kycDocumentUrls
    ? Object.entries(user.kycDocumentUrls)
    : [];

  return (
    <div className="p-8">
      <button
        onClick={() => router.push('/users')}
        className="text-muted text-[13px] mb-4 hover:text-ink"
      >
        ← Back to users
      </button>

      <div className="flex justify-between items-end gap-6 mb-6">
        <div>
          <Overline>● G3-US03 · USER</Overline>
          <h1 className="font-display text-[28px] font-medium tracking-tight mt-1 text-ink flex items-center gap-3">
            {user.fullName}
            <Badge kind={kycKind(user.kycStatus)}>
              KYC {user.kycStatus[0].toUpperCase() + user.kycStatus.slice(1)}
            </Badge>
            {user.suspended && <Badge kind="flagged">Suspended</Badge>}
          </h1>
          <div className="text-[13px] text-muted mt-1 font-mono">{user.id}</div>
        </div>
        <div className="flex gap-2">
          {isPendingKyc && (
            <>
              <Button kind="danger" onClick={() => setShowReject(true)}>
                Reject KYC
              </Button>
              <Button onClick={() => setShowApprove(true)}>Approve KYC →</Button>
            </>
          )}
          {user.suspended ? (
            <Button kind="secondary" onClick={() => setShowUnsuspend(true)}>
              Unsuspend
            </Button>
          ) : (
            <Button kind="secondary" onClick={() => setShowSuspend(true)}>
              Suspend
            </Button>
          )}
        </div>
      </div>

      {user.kycStatus === 'rejected' && user.kycRejectionReason && (
        <div className="mb-5 px-4 py-3 bg-[#F8E5E5] border border-[#EBC0C0] rounded-md">
          <Overline>KYC rejection reason</Overline>
          <div className="text-[13px] text-[#8A2828] mt-1">
            {user.kycRejectionReason}
          </div>
        </div>
      )}

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <Card kicker="● KYC DOCUMENTS" title="Submitted by the trader" padding={20}>
          {docEntries.length === 0 ? (
            <div className="text-muted text-[13px]">
              No KYC documents submitted yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {docEntries.map(([docType, url]) => (
                <div key={docType}>
                  <Overline>{DOC_LABEL[docType] ?? docType}</Overline>
                  <div className="mt-2 aspect-[4/3] w-full bg-parchment relative rounded border border-hairline overflow-hidden">
                    <Image
                      src={url}
                      alt={`${DOC_LABEL[docType] ?? docType} document`}
                      fill
                      style={{ objectFit: 'contain' }}
                      unoptimized
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card kicker="● PROFILE" title="Trader info">
            <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-[13px]">
              <dt className="text-muted">Role</dt>
              <dd className="text-ink">{ROLE_LABEL[user.role]}</dd>

              <dt className="text-muted">Phone</dt>
              <dd className="text-ink font-mono">{user.phone}</dd>

              <dt className="text-muted">Email</dt>
              <dd className="text-ink">{user.email ?? '—'}</dd>

              <dt className="text-muted">Location</dt>
              <dd className="text-ink">
                {user.city}, {user.country}
              </dd>

              <dt className="text-muted">Joined</dt>
              <dd className="text-ink font-mono">{fmt(user.createdAt)}</dd>
            </dl>
          </Card>

          <Card kicker="● KYC AUDIT" title="Review history">
            <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-[13px]">
              <dt className="text-muted">Status</dt>
              <dd>
                <Badge kind={kycKind(user.kycStatus)}>
                  {user.kycStatus[0].toUpperCase() + user.kycStatus.slice(1)}
                </Badge>
              </dd>

              {user.kycReviewedAt && (
                <>
                  <dt className="text-muted">Reviewed</dt>
                  <dd className="text-ink font-mono">
                    {fmt(user.kycReviewedAt)}
                  </dd>
                </>
              )}

              {user.kycReviewedById && (
                <>
                  <dt className="text-muted">Reviewer</dt>
                  <dd className="text-ink font-mono text-[11px] truncate">
                    {user.kycReviewedById}
                  </dd>
                </>
              )}
            </dl>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={showApprove}
        title="Approve this user's KYC?"
        body="The trader will gain full marketplace access (place orders, post listings)."
        confirmLabel="Approve KYC"
        busy={busy}
        onClose={() => setShowApprove(false)}
        onConfirm={() => onApprove()}
      />

      <ConfirmDialog
        open={showReject}
        title="Reject this user's KYC?"
        body="The trader will see your reason and can re-submit their documents."
        confirmLabel="Reject"
        danger
        requireReason
        busy={busy}
        onClose={() => setShowReject(false)}
        onConfirm={(reason) => onReject(reason)}
      />

      <ConfirmDialog
        open={showSuspend}
        title="Suspend this user?"
        body="They will be signed out immediately and unable to sign in until unsuspended."
        confirmLabel="Suspend"
        danger
        busy={busy}
        onClose={() => setShowSuspend(false)}
        onConfirm={() => onSuspend()}
      />

      <ConfirmDialog
        open={showUnsuspend}
        title="Unsuspend this user?"
        body="They will be able to sign in again."
        confirmLabel="Unsuspend"
        busy={busy}
        onClose={() => setShowUnsuspend(false)}
        onConfirm={() => onUnsuspend()}
      />
    </div>
  );
}

'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Overline } from '@/components/ui/Overline';
import {
  AdminUserDetail,
  Role,
  usersService,
} from '@/services/users.service';
import { errorMessage } from '@/services/api';
import { fmtDate, reviewKind, reviewLabel } from '@/lib/format';

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

type Dialog = 'approve' | 'reject' | 'suspend' | 'unsuspend' | null;

export default function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
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

  const run = async (
    action: () => Promise<AdminUserDetail>,
    errMsg: string,
  ) => {
    setBusy(true);
    try {
      setUser(await action());
    } catch (err) {
      setError(errorMessage(err, errMsg));
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
            <Badge kind={reviewKind(user.kycStatus)}>
              KYC {reviewLabel(user.kycStatus)}
            </Badge>
            {user.suspended && <Badge kind="flagged">Suspended</Badge>}
          </h1>
          <div className="text-[13px] text-muted mt-1 font-mono">{user.id}</div>
        </div>
        <div className="flex gap-2">
          {isPendingKyc && (
            <>
              <Button kind="danger" onClick={() => setDialog('reject')}>
                Reject KYC
              </Button>
              <Button onClick={() => setDialog('approve')}>Approve KYC →</Button>
            </>
          )}
          {user.suspended ? (
            <Button kind="secondary" onClick={() => setDialog('unsuspend')}>
              Unsuspend
            </Button>
          ) : (
            <Button kind="secondary" onClick={() => setDialog('suspend')}>
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
              <dd className="text-ink font-mono">{fmtDate(user.createdAt)}</dd>
            </dl>
          </Card>

          <Card kicker="● KYC AUDIT" title="Review history">
            <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-[13px]">
              <dt className="text-muted">Status</dt>
              <dd>
                <Badge kind={reviewKind(user.kycStatus)}>
                  {reviewLabel(user.kycStatus)}
                </Badge>
              </dd>

              {user.kycReviewedAt && (
                <>
                  <dt className="text-muted">Reviewed</dt>
                  <dd className="text-ink font-mono">
                    {fmtDate(user.kycReviewedAt)}
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
        open={dialog === 'approve'}
        title="Approve this user's KYC?"
        body="The trader will gain full marketplace access (place orders, post listings)."
        confirmLabel="Approve KYC"
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          run(
            () => usersService.reviewKyc(id, { decision: 'verified' }),
            'Approval failed.',
          )
        }
      />

      <ConfirmDialog
        open={dialog === 'reject'}
        title="Reject this user's KYC?"
        body="The trader will see your reason and can re-submit their documents."
        confirmLabel="Reject"
        danger
        requireReason
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => {
          if (!reason) return;
          return run(
            () =>
              usersService.reviewKyc(id, {
                decision: 'rejected',
                rejectionReason: reason,
              }),
            'Rejection failed.',
          );
        }}
      />

      <ConfirmDialog
        open={dialog === 'suspend'}
        title="Suspend this user?"
        body="They will be signed out immediately and unable to sign in until unsuspended."
        confirmLabel="Suspend"
        danger
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() => run(() => usersService.suspend(id), 'Suspend failed.')}
      />

      <ConfirmDialog
        open={dialog === 'unsuspend'}
        title="Unsuspend this user?"
        body="They will be able to sign in again."
        confirmLabel="Unsuspend"
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          run(() => usersService.unsuspend(id), 'Unsuspend failed.')
        }
      />
    </div>
  );
}

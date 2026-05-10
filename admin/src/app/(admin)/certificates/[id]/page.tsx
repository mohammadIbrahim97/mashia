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
  Certificate,
  CertificateStatus,
  certificatesService,
} from '@/services/certificates.service';
import { errorMessage } from '@/services/api';

const TYPE_LABEL: Record<string, string> = {
  vaccination: 'Vaccination',
  health: 'Health',
  origin: 'Origin',
};

function statusKind(s: CertificateStatus): BadgeKind {
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

export default function AdminCertificateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [cert, setCert] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    certificatesService
      .getById(id)
      .then((c) => {
        if (!cancelled) setCert(c);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load certificate.'));
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
      const updated = await certificatesService.verify(id, { status: 'verified' });
      setCert(updated);
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
      const updated = await certificatesService.verify(id, {
        status: 'rejected',
        rejectionReason: reason,
      });
      setCert(updated);
      setShowReject(false);
    } catch (err) {
      setError(errorMessage(err, 'Rejection failed.'));
      setShowReject(false);
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

  if (error || !cert) {
    return (
      <div className="p-8">
        <button
          onClick={() => router.push('/certificates')}
          className="text-muted text-[13px] mb-4 hover:text-ink"
        >
          ← Back to certificates
        </button>
        <div className="text-flagged text-[13px]">
          {error ?? 'Certificate not found.'}
        </div>
      </div>
    );
  }

  const isPending = cert.status === 'pending';

  return (
    <div className="p-8">
      <button
        onClick={() => router.push('/certificates')}
        className="text-muted text-[13px] mb-4 hover:text-ink"
      >
        ← Back to certificates
      </button>

      <div className="flex justify-between items-end gap-6 mb-6">
        <div>
          <Overline>● G3-US05 · CERTIFICATE</Overline>
          <h1 className="font-display text-[28px] font-medium tracking-tight mt-1 text-ink flex items-center gap-3">
            {TYPE_LABEL[cert.type] ?? cert.type} certificate
            <Badge kind={statusKind(cert.status)}>
              {cert.status[0].toUpperCase() + cert.status.slice(1)}
            </Badge>
          </h1>
          <div className="text-[13px] text-muted mt-1 font-mono">
            {cert.id}
          </div>
        </div>
        {isPending && (
          <div className="flex gap-2">
            <Button kind="danger" onClick={() => setShowReject(true)}>
              Reject
            </Button>
            <Button onClick={() => setShowApprove(true)}>Approve →</Button>
          </div>
        )}
      </div>

      {cert.status === 'rejected' && cert.rejectionReason && (
        <div className="mb-5 px-4 py-3 bg-[#F8E5E5] border border-[#EBC0C0] rounded-md">
          <Overline>Rejection reason</Overline>
          <div className="text-[13px] text-[#8A2828] mt-1">
            {cert.rejectionReason}
          </div>
        </div>
      )}

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <Card kicker="● DOCUMENT" title="Certificate file" padding={0}>
          <div className="aspect-[4/3] w-full bg-parchment relative">
            {cert.fileUrl ? (
              <Image
                src={cert.fileUrl}
                alt="Certificate document"
                fill
                style={{ objectFit: 'contain' }}
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted font-mono text-[11px] tracking-mono uppercase">
                No file
              </div>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card kicker="● METADATA" title="Issued by">
            <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-[13px]">
              <dt className="text-muted">Authority</dt>
              <dd className="text-ink">{cert.issuingAuthority}</dd>

              <dt className="text-muted">Type</dt>
              <dd className="text-ink">{TYPE_LABEL[cert.type] ?? cert.type}</dd>

              <dt className="text-muted">Issued</dt>
              <dd className="text-ink font-mono">{fmt(cert.issueDate)}</dd>

              <dt className="text-muted">Expires</dt>
              <dd className="text-ink font-mono">{fmt(cert.expiryDate)}</dd>

              <dt className="text-muted">Submitted</dt>
              <dd className="text-ink font-mono">{fmt(cert.createdAt)}</dd>

              {cert.verifiedAt && (
                <>
                  <dt className="text-muted">Reviewed</dt>
                  <dd className="text-ink font-mono">{fmt(cert.verifiedAt)}</dd>
                </>
              )}
            </dl>
          </Card>

          <Card kicker="● LINKED" title="Listing & seller">
            <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-[13px]">
              <dt className="text-muted">Seller ID</dt>
              <dd className="text-ink font-mono text-[11px] truncate">
                {cert.sellerId}
              </dd>

              <dt className="text-muted">Listing ID</dt>
              <dd className="text-ink font-mono text-[11px] truncate">
                {cert.listingId ?? '— unlinked —'}
              </dd>
            </dl>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={showApprove}
        title="Approve this certificate?"
        body="The linked listing will switch to 'certified' health status and the cert will be visible to buyers as verified."
        confirmLabel="Approve"
        busy={busy}
        onClose={() => setShowApprove(false)}
        onConfirm={() => onApprove()}
      />

      <ConfirmDialog
        open={showReject}
        title="Reject this certificate?"
        body="The seller will see your reason and can re-submit. The linked listing reverts to 'unchecked'."
        confirmLabel="Reject"
        danger
        requireReason
        busy={busy}
        onClose={() => setShowReject(false)}
        onConfirm={(reason) => onReject(reason)}
      />
    </div>
  );
}

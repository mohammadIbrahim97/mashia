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
  AdminListingDetail,
  listingsService,
} from '@/services/listings.service';
import { errorMessage } from '@/services/api';
import {
  fmtDate,
  fmtMoney,
  listingStatusKind,
  listingStatusLabel,
} from '@/lib/format';

type Dialog = 'flag' | 'unflag' | 'remove' | null;

export default function AdminListingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();

  const [listing, setListing] = useState<AdminListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listingsService
      .getById(id)
      .then((l) => {
        if (!cancelled) setListing(l);
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(errorMessage(err, 'Could not load listing.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const run = async (
    action: () => Promise<AdminListingDetail | { message: string }>,
    errMsg: string,
    onDelete?: boolean,
  ) => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      if (onDelete) {
        router.push('/listings');
        return;
      }
      setListing(result as AdminListingDetail);
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

  if (loadError || !listing) {
    return (
      <div className="p-8">
        <button
          onClick={() => router.push('/listings')}
          className="text-muted text-[13px] mb-4 hover:text-ink"
        >
          ← Back to listings
        </button>
        <div className="text-flagged text-[13px]">
          {loadError ?? 'Listing not found.'}
        </div>
      </div>
    );
  }

  const isDeleted = !!listing.deletedAt;
  const isFlagged = listing.status === 'flagged';
  const images = listing.images ?? [];
  const currentImage = images[imageIndex];

  return (
    <div className="p-8">
      <button
        onClick={() => router.push('/listings')}
        className="text-muted text-[13px] mb-4 hover:text-ink"
      >
        ← Back to listings
      </button>

      <div className="flex justify-between items-end gap-6 mb-6">
        <div>
          <Overline>● G3-US04 · LISTING</Overline>
          <h1 className="font-display text-[28px] font-medium tracking-tight mt-1 text-ink flex items-center gap-3">
            {listing.title}
            <Badge kind={listingStatusKind(listing.status)}>
              {listingStatusLabel(listing.status)}
            </Badge>
            {isDeleted && <Badge kind="flagged">Removed</Badge>}
          </h1>
          <div className="text-[13px] text-muted mt-1 font-mono">{listing.id}</div>
        </div>
        {!isDeleted && (
          <div className="flex gap-2">
            <Button kind="danger" onClick={() => setDialog('remove')}>
              Remove
            </Button>
            {isFlagged ? (
              <Button kind="secondary" onClick={() => setDialog('unflag')}>
                Unflag
              </Button>
            ) : (
              <Button kind="secondary" onClick={() => setDialog('flag')}>
                Flag
              </Button>
            )}
          </div>
        )}
      </div>

      {actionError && (
        <div className="mb-5 px-4 py-3 bg-[#F8E5E5] border border-[#EBC0C0] rounded-md text-[13px] text-[#8A2828]">
          {actionError}
        </div>
      )}

      {isDeleted && (
        <div className="mb-5 px-4 py-3 bg-parchment border border-hairline rounded-md text-[13px] text-muted">
          This listing was removed on {fmtDate(listing.deletedAt)}.
        </div>
      )}

      <div className="grid grid-cols-[1.4fr_1fr] gap-4">
        <div className="flex flex-col gap-4">
          <Card kicker="● MEDIA" title={`Photos (${images.length})`} padding={20}>
            {images.length === 0 ? (
              <div className="text-muted text-[13px]">No photos uploaded.</div>
            ) : (
              <>
                <div className="aspect-[4/3] w-full bg-parchment relative rounded border border-hairline overflow-hidden">
                  {currentImage && (
                    <Image
                      src={currentImage}
                      alt={`${listing.title} photo ${imageIndex + 1}`}
                      fill
                      style={{ objectFit: 'contain' }}
                      unoptimized
                    />
                  )}
                </div>
                {images.length > 1 && (
                  <div className="grid grid-cols-6 gap-2 mt-3">
                    {images.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setImageIndex(i)}
                        className={`aspect-square relative overflow-hidden rounded border-2 ${
                          i === imageIndex ? 'border-mashia-600' : 'border-hairline'
                        }`}
                      >
                        <Image
                          src={url}
                          alt={`thumbnail ${i + 1}`}
                          fill
                          style={{ objectFit: 'cover' }}
                          unoptimized
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          {listing.description && (
            <Card kicker="● DESCRIPTION" title="Seller's pitch">
              <p className="text-[13px] text-ink whitespace-pre-wrap">
                {listing.description}
              </p>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card kicker="● ANIMAL" title="Specs">
            <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-[13px]">
              <dt className="text-muted">Breed</dt>
              <dd className="text-ink capitalize">{listing.breed}</dd>

              <dt className="text-muted">Quantity</dt>
              <dd className="text-ink">{listing.quantity} head</dd>

              <dt className="text-muted">Age</dt>
              <dd className="text-ink">{listing.ageMonths} months</dd>

              <dt className="text-muted">Weight</dt>
              <dd className="text-ink">{listing.weightKg} kg</dd>

              <dt className="text-muted">Price / head</dt>
              <dd className="text-ink font-mono">
                {fmtMoney(listing.pricePerHead, listing.currency)}
              </dd>

              <dt className="text-muted">Origin</dt>
              <dd className="text-ink">
                {listing.originCity}, {listing.originCountry}
              </dd>

              <dt className="text-muted">Health</dt>
              <dd className="text-ink capitalize">{listing.healthStatus}</dd>
            </dl>
          </Card>

          <Card kicker="● SELLER" title="Owner">
            <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-[13px]">
              <dt className="text-muted">Name</dt>
              <dd className="text-ink">{listing.seller?.fullName ?? '—'}</dd>

              <dt className="text-muted">Phone</dt>
              <dd className="text-ink font-mono">
                {listing.seller?.phone ?? '—'}
              </dd>

              <dt className="text-muted">Location</dt>
              <dd className="text-ink">
                {listing.seller?.city ?? '—'},{' '}
                {listing.seller?.country ?? '—'}
              </dd>

              <dt className="text-muted">KYC</dt>
              <dd className="text-ink capitalize">
                {listing.seller?.kycStatus ?? '—'}
              </dd>
            </dl>
            {listing.seller && (
              <div className="mt-4">
                <Button
                  kind="ghost"
                  size="sm"
                  onClick={() =>
                    router.push(`/users/${listing.seller!.id}`)
                  }
                >
                  View seller profile →
                </Button>
              </div>
            )}
          </Card>

          <Card kicker="● METADATA" title="Timestamps">
            <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-[13px]">
              <dt className="text-muted">Created</dt>
              <dd className="text-ink font-mono">
                {fmtDate(listing.createdAt)}
              </dd>

              <dt className="text-muted">Updated</dt>
              <dd className="text-ink font-mono">
                {fmtDate(listing.updatedAt)}
              </dd>

              {listing.deletedAt && (
                <>
                  <dt className="text-muted">Deleted</dt>
                  <dd className="text-ink font-mono">
                    {fmtDate(listing.deletedAt)}
                  </dd>
                </>
              )}
            </dl>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'flag'}
        title="Flag this listing?"
        body="Flagging hides the listing from the buyer feed and marks it for follow-up. The seller is not removed."
        confirmLabel="Flag"
        danger
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() => run(() => listingsService.flag(id), 'Flag failed.')}
      />

      <ConfirmDialog
        open={dialog === 'unflag'}
        title="Unflag this listing?"
        body="The listing will return to active status and reappear in the buyer feed."
        confirmLabel="Unflag"
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          run(() => listingsService.unflag(id), 'Unflag failed.')
        }
      />

      <ConfirmDialog
        open={dialog === 'remove'}
        title="Remove this listing?"
        body="The listing will be soft-deleted and disappear from the marketplace. Existing orders linked to it remain intact. This cannot be undone from the dashboard."
        confirmLabel="Remove"
        danger
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          run(() => listingsService.remove(id), 'Remove failed.', true)
        }
      />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Button } from './Button';
import { Overline } from './Overline';

type Props = {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
  requireReason?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  danger,
  requireReason,
  busy,
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) {
      setReason('');
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  const canConfirm = !busy && (!requireReason || reason.trim().length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(20,24,26,0.55)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={body ? "confirm-dialog-desc" : undefined}
        className="bg-paper border border-hairline rounded-md w-[460px] p-7 shadow-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div id="confirm-dialog-title" className="font-display text-[22px] font-medium tracking-tight text-ink">
          {title}
        </div>
        {body && (
          <div id="confirm-dialog-desc" className="mt-2 text-sm text-muted leading-[1.55]">{body}</div>
        )}
        {requireReason && (
          <div className="mt-4">
            <Overline>Reason · required</Overline>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Explain why — visible to the user."
              className="mt-1.5 w-full p-3 font-body text-[13px] text-ink bg-parchment border border-hairline rounded outline-none resize-y focus:border-mashia-600"
            />
          </div>
        )}
        <div className="flex gap-2 mt-5 justify-end">
          <Button kind="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            kind={danger ? 'danger' : 'primary'}
            onClick={() => onConfirm(requireReason ? reason.trim() : undefined)}
            disabled={!canConfirm}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

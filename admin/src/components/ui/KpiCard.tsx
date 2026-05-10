import { ReactNode } from 'react';
import { Overline } from './Overline';

type Tone = 'neutral' | 'accent' | 'warn' | 'danger';

const TONE: Record<Tone, { ring: string; dot: string }> = {
  neutral: { ring: 'border-hairline', dot: 'bg-muted' },
  accent: { ring: 'border-mashia-200', dot: 'bg-mashia-600' },
  warn: { ring: 'border-[#E8CB8E]', dot: 'bg-gold' },
  danger: { ring: 'border-[#EBC0C0]', dot: 'bg-flagged' },
};

type Props = {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  tone?: Tone;
  onClick?: () => void;
};

export function KpiCard({
  label,
  value,
  unit,
  hint,
  tone = 'neutral',
  onClick,
}: Props) {
  const t = TONE[tone];
  const interactive = !!onClick;
  return (
    <div
      onClick={onClick}
      className={`bg-paper border ${t.ring} rounded-md p-[18px] flex flex-col gap-2.5 min-h-[118px] transition-shadow duration-150 ${
        interactive ? 'cursor-pointer hover:shadow-1' : ''
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full inline-block ${t.dot}`} />
        <Overline>{label}</Overline>
      </div>
      <div className="flex items-baseline gap-1.5">
        <div className="font-display text-[32px] font-medium tracking-tight leading-none text-ink">
          {value}
        </div>
        {unit && (
          <div className="font-mono text-[11px] tracking-mono uppercase text-muted">
            {unit}
          </div>
        )}
      </div>
      {hint && <div className="text-xs text-muted mt-auto">{hint}</div>}
    </div>
  );
}

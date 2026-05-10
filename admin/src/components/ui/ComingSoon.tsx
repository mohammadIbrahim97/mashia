import { Construction } from 'lucide-react';
import { Overline } from './Overline';

type Props = {
  section: string;
  us: string;
};

export function ComingSoon({ section, us }: Props) {
  return (
    <div className="p-8">
      <div className="flex justify-between items-baseline mb-5">
        <div>
          <Overline>● {us} · DRAFT</Overline>
          <h1 className="font-display text-[28px] font-medium tracking-tight mt-1 text-ink">
            {section}
          </h1>
          <div className="text-[13px] text-muted mt-1">
            Designed and scoped — landing in the next phase.
          </div>
        </div>
      </div>
      <div className="bg-paper border border-hairline rounded-md p-16 text-center">
        <div className="inline-flex w-14 h-14 rounded-full bg-mashia-50 items-center justify-center mb-3">
          <Construction size={24} strokeWidth={1.5} className="text-mashia-700" />
        </div>
        <div className="font-display text-lg font-medium text-ink">
          {section} screen is on the roadmap
        </div>
        <div className="text-[13px] text-muted mt-1 max-w-md mx-auto">
          The polished design is ready in the project bundle. The matching
          backend admin endpoints aren&apos;t built yet, so this page is
          intentionally a placeholder until both halves land together.
        </div>
      </div>
    </div>
  );
}

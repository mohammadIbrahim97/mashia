import { ReactNode } from 'react';
import { Overline } from './Overline';

type Props = {
  kicker?: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  padding?: number;
  children?: ReactNode;
  className?: string;
};

export function Card({
  kicker,
  title,
  action,
  padding = 20,
  children,
  className = '',
}: Props) {
  const hasHeader = kicker || title || action;
  return (
    <section
      className={`bg-paper border border-hairline rounded-md ${className}`}
    >
      {hasHeader && (
        <header className="px-5 py-4 border-b border-hairline flex items-center justify-between gap-3">
          <div>
            {kicker && <Overline>{kicker}</Overline>}
            {title && (
              <div
                className={`font-display text-[17px] font-medium text-ink ${
                  kicker ? 'mt-0.5' : ''
                }`}
              >
                {title}
              </div>
            )}
          </div>
          {action}
        </header>
      )}
      <div style={{ padding }}>{children}</div>
    </section>
  );
}

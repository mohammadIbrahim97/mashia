import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

export function Overline({ children, className = '' }: Props) {
  return (
    <div
      className={`font-mono text-[11px] tracking-mono-wide uppercase text-muted ${className}`}
    >
      {children}
    </div>
  );
}

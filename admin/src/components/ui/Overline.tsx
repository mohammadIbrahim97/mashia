import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
};

export function Overline({ children, className = '', htmlFor }: Props) {
  if (htmlFor) {
    return (
      <label
        htmlFor={htmlFor}
        className={`block font-mono text-[11px] tracking-mono-wide uppercase text-muted ${className}`}
      >
        {children}
      </label>
    );
  }

  return (
    <div
      className={`font-mono text-[11px] tracking-mono-wide uppercase text-muted ${className}`}
    >
      {children}
    </div>
  );
}

import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  id?: string;
};

export function Overline({ children, className = '', htmlFor, id }: Props) {
  const baseClasses = `font-mono text-[11px] tracking-mono-wide uppercase text-muted ${className}`;

  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} id={id} className={`block ${baseClasses}`}>
        {children}
      </label>
    );
  }

  return (
    <div id={id} className={baseClasses}>
      {children}
    </div>
  );
}

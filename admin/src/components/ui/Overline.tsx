import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
};

export function Overline({ children, className = '', htmlFor }: Props) {
  const Tag = htmlFor ? 'label' : 'div';
  return (
    <Tag
      htmlFor={htmlFor}
      className={`font-mono text-[11px] tracking-mono-wide uppercase text-muted ${className}`}
    >
      {children}
    </Tag>
  );
}

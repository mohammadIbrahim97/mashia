import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
};

export function Overline({ children, className = "", htmlFor }: Props) {
  const classes = `font-mono text-[11px] tracking-mono-wide uppercase text-muted ${className}`;
  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className={classes}>
        {children}
      </label>
    );
  }
  return <div className={classes}>{children}</div>;
}

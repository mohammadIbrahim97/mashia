import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
};

export function Overline({ children, className = "", htmlFor }: Props) {
  const Component = htmlFor ? "label" : "div";
  return (
    <Component
      htmlFor={htmlFor}
      className={`font-mono text-[11px] tracking-mono-wide uppercase text-muted ${className}`}
    >
      {children}
    </Component>
  );
}

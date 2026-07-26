import { ButtonHTMLAttributes, ReactNode } from "react";

type Kind = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: Kind;
  size?: Size;
  children: ReactNode;
};

const KIND: Record<Kind, string> = {
  primary:
    "bg-mashia-600 text-paper border-transparent hover:bg-mashia-700 focus-visible:ring-mashia-600",
  secondary:
    "bg-transparent text-ink border-ink hover:bg-ink hover:text-paper focus-visible:ring-ink",
  ghost:
    "bg-transparent text-mashia-600 border-transparent hover:bg-mashia-50 focus-visible:ring-mashia-600",
  danger:
    "bg-flagged text-paper border-transparent hover:opacity-90 focus-visible:ring-flagged",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-[13px]",
};

export function Button({
  kind = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={`font-body font-semibold border rounded-md transition-colors duration-150 ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${SIZE[size]} ${KIND[kind]} ${className}`}
    >
      {children}
    </button>
  );
}

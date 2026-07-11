import { ReactNode } from "react";

export type BadgeKind = "verified" | "pending" | "flagged" | "info" | "neutral";

const STYLE: Record<BadgeKind, string> = {
  verified: "bg-mashia-50 text-mashia-700 border-mashia-200",
  pending: "bg-[#FBF1DD] text-[#8A6418] border-[#E8CB8E]",
  flagged: "bg-[#F8E5E5] text-[#8A2828] border-[#EBC0C0]",
  info: "bg-[#E5EEF5] text-medblue border-[#BDD2E2]",
  neutral: "bg-paper text-ink border-hairline",
};

type Props = {
  kind?: BadgeKind;
  children: ReactNode;
};

export function Badge({ kind = "neutral", children }: Props) {
  return (
    <span
      className={`inline-flex px-2 py-[2px] rounded-full font-body font-semibold text-[11px] border ${STYLE[kind]}`}
    >
      {children}
    </span>
  );
}

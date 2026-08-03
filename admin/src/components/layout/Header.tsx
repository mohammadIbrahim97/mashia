"use client";

import { Search, Bell } from "lucide-react";
import { useEffect, useRef } from "react";

type Props = {
  title: string;
  breadcrumb?: string;
};

export function Header({ title, breadcrumb }: Props) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="h-16 px-8 flex items-center justify-between border-b border-hairline bg-paper">
      <div>
        {breadcrumb && (
          <div className="font-mono text-[11px] tracking-mono-wide uppercase text-muted">
            {breadcrumb}
          </div>
        )}
        <div
          className={`font-display text-[22px] font-medium tracking-tight ${
            breadcrumb ? "mt-0.5" : ""
          }`}
        >
          {title}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-2 bg-parchment border border-hairline rounded-md w-[280px] focus-within:ring-2 focus-within:ring-mashia-600 focus-within:border-transparent transition-all">
          <Search size={16} strokeWidth={1.5} className="text-muted" />
          <input
            ref={searchInputRef}
            placeholder="Search orders, users…"
            aria-label="Global search"
            className="flex-1 bg-transparent border-none outline-none font-body text-[13px] text-ink"
          />
          <span
            className="font-mono text-[10px] text-muted px-1.5 py-px bg-paper border border-hairline rounded"
            aria-hidden="true"
          >
            ⌘K
          </span>
        </div>
        <button
          aria-label="Notifications"
          className="text-ink hover:text-mashia-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mashia-600 rounded-full p-1 -m-1 transition-colors cursor-pointer"
        >
          <Bell size={20} strokeWidth={1.5} />
        </button>
        <button
          aria-label="User profile"
          className="w-8 h-8 rounded-full bg-mashia-600 text-paper flex items-center justify-center font-display font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:ring-offset-2 transition-transform hover:scale-105 cursor-pointer"
        >
          L
        </button>
      </div>
    </header>
  );
}

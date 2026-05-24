'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  Users,
  ListChecks,
  Shield,
  ShoppingBag,
  FileText,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { session } from '@/services/session';

type Item = {
  href: string;
  label: string;
  us: string;
  Icon: typeof LayoutGrid;
  badge?: number;
  badgeKind?: 'warn' | 'danger';
};

const ITEMS: Item[] = [
  { href: '/dashboard', label: 'Dashboard', us: 'G3-US02', Icon: LayoutGrid },
  { href: '/users', label: 'Users', us: 'G3-US03', Icon: Users },
  { href: '/listings', label: 'Listings', us: 'G3-US04', Icon: ListChecks },
  { href: '/certificates', label: 'Certificates', us: 'G3-US05', Icon: Shield },
  { href: '/orders', label: 'Orders', us: 'G3-US06', Icon: ShoppingBag },
  { href: '/payments', label: 'Payments', us: 'G3-US07', Icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const onSignOut = () => {
    session.clear();
    router.push('/login');
  };
  return (
    <aside className="w-60 bg-basalt text-sand h-full flex flex-col py-5 shrink-0">
      <div className="px-5 pb-5 border-b border-sand/15">
        <div className="font-display text-2xl font-light tracking-tight text-paper">
          Mash
          <em className="italic text-gold not-italic" style={{ fontStyle: 'italic' }}>
            ia
          </em>
          <span className="text-gold">.</span>
        </div>
        <div className="font-mono text-[9px] tracking-mono-xwide uppercase mt-1.5 opacity-70">
          ● ADMIN · me-south-1
        </div>
      </div>

      <nav className="px-3 py-3.5 flex flex-col gap-0.5 flex-1">
        {ITEMS.map((it) => {
          const sel = pathname === it.href || pathname.startsWith(`${it.href}/`);
          const dotColor = it.badgeKind === 'danger' ? 'bg-[#E89595]' : 'bg-gold';
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`grid grid-cols-[20px_1fr_auto] items-center gap-3 px-3 py-2.5 rounded-md text-left border-l-2 transition-colors ${
                sel
                  ? 'bg-white/[0.06] text-paper border-gold'
                  : 'text-sand border-transparent hover:bg-white/[0.03]'
              }`}
            >
              <it.Icon
                size={18}
                strokeWidth={1.5}
                className={sel ? 'text-gold' : 'text-sand'}
              />
              <div className="min-w-0">
                <div className={`font-body text-[13px] ${sel ? 'font-semibold' : 'font-normal'}`}>
                  {it.label}
                </div>
                <div className="font-mono text-[9px] tracking-mono-wide opacity-50 mt-0.5">
                  {it.us}
                </div>
              </div>
              {it.badge ? (
                <span
                  className={`${dotColor} text-basalt font-mono text-[10px] font-bold px-1.5 py-px rounded-full`}
                >
                  {it.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3.5 border-t border-sand/15 flex flex-col gap-2">
        <button className="flex items-center justify-between px-3 py-2 bg-transparent border border-sand/20 rounded-md cursor-pointer text-sand font-body text-xs">
          <span>Language</span>
          <span className="font-mono text-[11px] tracking-mono uppercase text-gold flex items-center gap-1">
            EN <ChevronDown size={12} />
          </span>
        </button>
        <button
          onClick={onSignOut}
          className="flex items-center gap-2.5 px-3 py-2 bg-transparent border-none cursor-pointer text-sand font-body text-xs rounded-md hover:bg-white/[0.03]"
        >
          <div className="w-6 h-6 rounded-full bg-gold text-basalt flex items-center justify-center font-display font-semibold text-xs">
            L
          </div>
          <div className="flex-1 text-left">
            <div className="font-semibold">Layla A.</div>
            <div className="text-[10px] opacity-60 font-mono tracking-mono">
              SUPER · ADMIN
            </div>
          </div>
          <LogOut size={14} className="opacity-60" />
        </button>
        <div className="font-mono text-[9px] tracking-mono-wide opacity-40 px-3 pt-1">
          v1.0 · 2026
        </div>
      </div>
    </aside>
  );
}

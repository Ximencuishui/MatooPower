'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n';

const TABS = [
  { href: '/home', key: 'home' as const, icon: '⌂' },
  { href: '/devices', key: 'devices' as const, icon: '◧' },
  { href: '/shop', key: 'shop' as const, icon: '⬚' },
  { href: '/messages', key: 'messages' as const, icon: '✉' },
  { href: '/profile', key: 'profile' as const, icon: '◯' },
];

export function TabBar() {
  const path = usePathname();
  const { t } = useT();
  return (
    <nav className="tabbar">
      {TABS.map((tb) => {
        const active = path?.startsWith(tb.href);
        return (
          <Link key={tb.href} href={tb.href} className={`tab ${active ? 'active' : ''}`}>
            <span className="tab-icon text-lg" aria-hidden="true">{tb.icon}</span>
            <span>{t.tabs[tb.key]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

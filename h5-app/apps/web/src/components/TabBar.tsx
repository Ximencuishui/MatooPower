'use client';
// P2-9:TabBar 完整路径匹配(避免 /devices/compare 高亮 /devices)
// P2-9 + P2-23:tab 切换 active 过渡颜色 + focus-visible
// P1 RTL-1:RTL 语言(ur)下,tab 顺序镜像反向(视觉顺序:profile..home)
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

// 完整路径匹配:active 当且仅当 pathname 完全等于 href 或 pathname 以 href + '/' 开头
function isActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + '/');
}

export function TabBar() {
  const path = usePathname();
  const { t, lang } = useT();
  // P1 RTL-1:RTL 语言(ur)下视觉顺序反向;按 lang 触发而非 DOM dir 轮询
  const tabs = lang === 'ur' ? [...TABS].reverse() : TABS;
  return (
    <nav className="tabbar" aria-label="主导航">
      {tabs.map((tb) => {
        const active = isActive(path, tb.href);
        const label = t.tabs[tb.key];
        return (
          <Link
            key={tb.href}
            href={tb.href}
            aria-current={active ? 'page' : undefined}
            aria-label={label}
            className={`tab transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matoo focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900 rounded-md ${active ? 'active' : ''}`}
          >
            <span className="tab-icon text-lg" aria-hidden="true">{tb.icon}</span>
            {/* 窄屏(< 360px)隐藏文字,仅图标 */}
            <span className="tab-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
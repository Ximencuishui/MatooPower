// Admin 桌面侧边栏：导航 + theme/locale 切换 + 当前用户 + 退出
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, clearSession } from '@/lib/auth-store';
import { useLocale } from '@/lib/useLocale';
import { getDict } from '@/lib/i18n';
import { ThemeToggle } from './ThemeToggle';
import { LangSwitch } from './LangSwitch';

interface NavItem {
  href: string;
  labelZh: string;
  labelEn: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/overview', labelZh: '运营概览', labelEn: 'Overview', icon: '📊' },
  { href: '/admin/tickets', labelZh: '工单管理', labelEn: 'Tickets', icon: '🎫' },
  { href: '/admin/users', labelZh: '用户管理', labelEn: 'Users', icon: '👥' },
  { href: '/admin/warranties', labelZh: '保修管理', labelEn: 'Warranties', icon: '🛡' },
  { href: '/admin/sku-list', labelZh: 'SKU 商品', labelEn: 'SKUs', icon: '📦' },
  { href: '/admin/devices', labelZh: '设备管理', labelEn: 'Devices', icon: '📱' },
  { href: '/admin/dealers', labelZh: '经销商管理', labelEn: 'Dealers', icon: '🤝' },
  { href: '/admin/sku-resources', labelZh: 'SKU 资源', labelEn: 'SKU Resources', icon: '🏷' },
  { href: '/admin/audit', labelZh: '审计日志', labelEn: 'Audit Log', icon: '🧾' },
  { href: '/admin/analytics', labelZh: '数据分析', labelEn: 'Analytics', icon: '📈' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const { locale } = useLocale();
  const dict = getDict(locale);

  function handleLogout() {
    clearSession();
    router.push('/auth?next=/admin/overview');
  }

  return (
    <aside className="w-60 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
      {/* Logo（与 website 同源：浅色 logo.svg / 暗色 logo-white.svg） */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col gap-1.5">
          <img
            src="/logo.svg"
            alt="Matoo Power"
            width={160}
            height={36}
            className="block dark:hidden h-9 w-auto"
          />
          <img
            src="/logo-white.svg"
            alt="Matoo Power"
            width={160}
            height={36}
            className="hidden dark:block h-9 w-auto"
          />
          <span className="text-[10px] uppercase tracking-wider text-matoo font-medium pl-0.5">
            Admin Console
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                active
                  ? 'bg-matoo-light dark:bg-matoo/20 text-matoo-dark dark:text-matoo-light font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span aria-hidden="true" className="text-base">
                {item.icon}
              </span>
              <span>{locale === 'zh' ? item.labelZh : item.labelEn}</span>
            </Link>
          );
        })}
      </nav>

      {/* Toolbar: theme + lang */}
      <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <ThemeToggle />
        <LangSwitch />
      </div>

      {/* User / Logout */}
      <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-3 space-y-2">
        {session?.user && (
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-matoo-light dark:bg-matoo/20 text-matoo-dark dark:text-matoo-light flex items-center justify-center text-sm font-semibold">
              {(session.user.displayName ?? session.user.phone ?? '?')
                .slice(0, 1)
                .toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">
                {session.user.displayName ?? session.user.phone}
              </div>
              <div className="text-[11px] text-slate-500 capitalize">
                {session.user.role}
              </div>
            </div>
          </div>
        )}
        <button onClick={handleLogout} className="btn-ghost w-full justify-center">
          {dict.user.logout}
        </button>
      </div>
    </aside>
  );
}
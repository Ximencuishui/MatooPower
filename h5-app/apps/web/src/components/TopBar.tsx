'use client';
import { useRouter, usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { ThemeQuickButton } from './ThemeQuickButton';

// 不显示返回按钮的根页面集合(避免点返回退到空白或退出应用)
const ROOT_PATHS = new Set<string>([
  '/home',
  '/devices',
  '/shop',
  '/profile',
  '/messages',
]);

export function TopBar({
  title,
  right,
  /** 在标题左侧插入额外内容(例如管理员 breadcrumb "返回我的") */
  leftExtra,
  /** P0-3:是否在标题前自动插入 ThemeQuickButton(默认 true,极个别极简页面可关闭) */
  showThemeToggle = true,
}: {
  title: string;
  right?: ReactNode;
  leftExtra?: ReactNode;
  showThemeToggle?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const showBack = !ROOT_PATHS.has(pathname);

  return (
    <header className="topbar">
      {showBack ? (
        <button aria-label="back" className="back-btn" onClick={() => router.back()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <span className="w-9" aria-hidden="true" />
      )}
      {leftExtra}
      <h1 className="text-[15px] font-semibold truncate min-w-0 px-2" title={title}>{title}</h1>
      <div className="flex items-center justify-end gap-1">
        {showThemeToggle && <ThemeQuickButton />}
        {right}
      </div>
    </header>
  );
}

/** P2-10:管理员面包屑 — 返回我的工作台(overview) */
export function AdminBreadcrumb() {
  return (
    <a
      href="/admin/overview"
      className="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 hover:underline px-2"
      aria-label="返回管理员工作台"
    >
      <span aria-hidden="true">📊</span>
      工作台
    </a>
  );
}

/** P2-10:经销商面包屑 — 返回经销商工作台 */
export function DealerBreadcrumb() {
  return (
    <a
      href="/dealer/dashboard"
      className="hidden sm:inline-flex items-center gap-1 text-[11px] text-matoo hover:underline px-2"
      aria-label="返回经销商工作台"
    >
      <span aria-hidden="true">🛒</span>
      工作台
    </a>
  );
}
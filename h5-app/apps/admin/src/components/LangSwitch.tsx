// Admin 桌面端语言切换器（zh / en）
// - 两态切换按钮（zh | en）
// - 显示当前语言 + 切换到另一种
'use client';

import { useLocale } from '@/lib/useLocale';

export function LangSwitch() {
  const { locale, setLocale } = useLocale();
  const next = locale === 'zh' ? 'en' : 'zh';
  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      title={`Switch to ${next === 'zh' ? '中文' : 'English'}`}
      aria-label={`Switch language to ${next === 'zh' ? 'Chinese' : 'English'}`}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition text-sm font-medium"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
      <span className="uppercase tracking-wider">{locale}</span>
    </button>
  );
}
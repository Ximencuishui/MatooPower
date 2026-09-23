'use client';
// AppearanceCard:Profile 页面专用的"外观"主题切换面板 — 三张大尺寸 radio 卡片
// 共享 useThemeMode hook,与头部 ThemeToggle 状态同步

import { useT } from '@/lib/i18n';
import { useThemeMode, type ThemeMode } from '@/hooks/useThemeMode';

type Opt = {
  k: ThemeMode;
  icon: string;
  preview: 'light' | 'dark' | 'auto';
  labelKey: string;
  descKey: 'lightDesc' | 'systemDesc' | 'darkDesc';
};

export function AppearanceCard() {
  const { t } = useT();
  const { mode, setMode } = useThemeMode();

  const opts: Opt[] = [
    { k: 'light', icon: '☀️', preview: 'light', labelKey: 'themeLight', descKey: 'lightDesc' },
    { k: 'system', icon: '⚙️', preview: 'auto', labelKey: 'themeSystem', descKey: 'systemDesc' },
    { k: 'dark', icon: '🌙', preview: 'dark', labelKey: 'themeDark', descKey: 'darkDesc' },
  ];

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-semibold">{t.profile.appearanceTitle}</h4>
        <span aria-live="polite" className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {mode === 'light' && (t.common.themeLight ?? '')}
          {mode === 'system' && (t.common.themeSystem ?? '')}
          {mode === 'dark' && (t.common.themeDark ?? '')}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t.profile.appearanceDesc}</p>
      <div role="radiogroup" aria-label="appearance" className="grid grid-cols-3 gap-2">
        {opts.map((o) => {
          const active = mode === o.k;
          const label = (t.common as any)[o.labelKey] ?? o.k;
          const desc = (t.profile as any)[o.descKey] ?? '';
          return (
            <button
              key={o.k}
              role="radio"
              aria-checked={active}
              onClick={() => setMode(o.k)}
              className={`text-left p-2.5 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-matoo/40 ${
                active
                  ? 'border-matoo bg-matoo-light/40 dark:bg-matoo/20 dark:border-matoo-light'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {/* 视觉预览 */}
              <div
                className={`h-10 rounded-md mb-2 flex items-center justify-center text-lg ${
                  o.preview === 'light'
                    ? 'bg-white text-amber-500 ring-1 ring-slate-200'
                    : o.preview === 'dark'
                    ? 'bg-slate-900 text-slate-100 ring-1 ring-slate-700'
                    : 'bg-gradient-to-r from-white to-slate-900 text-slate-700 ring-1 ring-slate-300'
                }`}
                aria-hidden="true"
              >
                {o.icon}
              </div>
              <div className={`text-xs font-semibold ${active ? 'text-matoo dark:text-matoo-light' : ''}`}>{label}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 line-clamp-2">{desc}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

'use client';
// ThemeToggle:亮/暗/系统三态切换(紧凑图标按钮,适合放头部)
// 状态由 useThemeMode 管理,与其他主题入口(如 Profile AppearanceCard)共享

import { useT } from '@/lib/i18n';
import { useThemeMode, type ThemeMode } from '@/hooks/useThemeMode';

export function ThemeToggle() {
  const { t } = useT();
  const { mode, setMode } = useThemeMode();

  const opts: Array<{ k: ThemeMode; icon: string; label: string }> = [
    { k: 'light', icon: '☀️', label: t.common.themeLight ?? '亮' },
    { k: 'system', icon: '⚙️', label: t.common.themeSystem ?? '系统' },
    { k: 'dark', icon: '🌙', label: t.common.themeDark ?? '暗' },
  ];

  return (
    <div role="radiogroup" aria-label="theme" className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 text-xs">
      {opts.map((o) => (
        <button
          key={o.k}
          role="radio"
          aria-checked={mode === o.k}
          onClick={() => setMode(o.k)}
          className={`px-2 py-1 rounded-md inline-flex items-center gap-1 ${mode === o.k ? 'bg-white dark:bg-slate-700 shadow-sm font-semibold' : 'text-slate-500 dark:text-slate-400'}`}
          title={o.label}
        >
          <span aria-hidden="true">{o.icon}</span>
        </button>
      ))}
    </div>
  );
}

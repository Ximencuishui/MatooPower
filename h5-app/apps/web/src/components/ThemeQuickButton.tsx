'use client';
// ThemeQuickButton:P0-3 v1.2 — 单一图标按钮在 light/dark 间切换(快捷入口)
// 与 ThemeToggle(3 态 radiogroup,适合 profile 详细面板)互补,放在 TopBar 头部更显眼
// 状态从 useThemeMode 共享,可被 AppearanceCard / ThemeToggle 同步刷新

import { useT } from '@/lib/i18n';
import { useThemeMode } from '@/hooks/useThemeMode';

export function ThemeQuickButton() {
  const { t } = useT();
  const { mode, setMode, systemDark } = useThemeMode();
  // 解析当前实际 dark 状态:system 时跟随系统,否则按 mode
  const dark = mode === 'system' ? (systemDark ?? false) : mode === 'dark';
  const next = dark ? 'light' : 'dark';
  const icon = dark ? '☀️' : '🌙';
  const label = dark ? t.common.themeLight ?? '亮色' : t.common.themeDark ?? '暗色';
  const title = t.common.themeToggle ?? '切换主题';
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={() => setMode(next)}
      className="w-9 h-9 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-base inline-flex items-center justify-center"
    >
      <span aria-hidden="true">{icon}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
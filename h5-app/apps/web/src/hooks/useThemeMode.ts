'use client';
// useThemeMode:三态主题 (light / dark / system) 单源真相 — ThemeToggle 与 AppearanceCard 共享
// 数据源:localStorage 'matoo.theme.mode', 通过自定义事件 'matoo:theme-change' 在同标签页内同步,
// 通过 'storage' 事件在跨标签页同步。
// 应用层:在 .dark 类切换到 <html>,并通过 i18n setDark 同步二进制状态(供其他 hook 读取)。

import { useCallback, useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';

export type ThemeMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'matoo.theme.mode';
const EVENT_NAME = 'matoo:theme-change';

function readMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

function resolveDark(mode: ThemeMode): boolean {
  if (typeof window === 'undefined') return false;
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function applyClass(dark: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', dark);
}

function broadcast(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent<ThemeMode>(EVENT_NAME, { detail: mode }));
  } catch {
    /* 旧浏览器无 CustomEvent 构造 detail,降级到 storage 事件机制 */
  }
}

export function useThemeMode() {
  const { setDark } = useT();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // 初始化 + 监听同标签页自定义事件 / 跨标签页 storage
  useEffect(() => {
    setModeState(readMode());
    const onLocal = (e: Event) => {
      const next = (e as CustomEvent<ThemeMode>).detail;
      if (next && (next === 'light' || next === 'dark' || next === 'system')) {
        setModeState(next);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setModeState(readMode());
    };
    window.addEventListener(EVENT_NAME, onLocal as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onLocal as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
      const dark = resolveDark(next);
      applyClass(dark);
      setDark(dark); // 同步给 i18n context
      broadcast(next);
    },
    [setDark],
  );

  // system 模式需要监听 prefers-color-scheme 变化
  const systemDark = mode === 'system' ? resolveDark('system') : null;
  useEffect(() => {
    if (mode !== 'system' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const d = mq.matches;
      applyClass(d);
      setDark(d);
    };
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, [mode, setDark]);

  return { mode, setMode, systemDark };
}

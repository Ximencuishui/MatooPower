// Admin 桌面端 locale hook（zh / en）
// - localStorage 持久化
// - 监听 storage 事件做多 tab 同步
// - 同步到 <html lang> 属性（无障碍 + 浏览器翻译）
'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Locale } from './i18n';

const STORAGE_KEY = 'matoo.admin.locale.v1';

function readLocale(): Locale {
  if (typeof window === 'undefined') return 'zh';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'zh' || raw === 'en') return raw;
  } catch {
    /* ignore */
  }
  const nav = window.navigator?.language ?? 'zh';
  return nav.toLowerCase().startsWith('en') ? 'en' : 'zh';
}

function applyLocale(loc: Locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = loc === 'zh' ? 'zh-CN' : 'en';
}

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>('zh');

  useEffect(() => {
    const l = readLocale();
    setLocaleState(l);
    applyLocale(l);
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'zh' || e.newValue === 'en')) {
        setLocaleState(e.newValue);
        applyLocale(e.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyLocale(next);
  }, []);

  return { locale, setLocale };
}
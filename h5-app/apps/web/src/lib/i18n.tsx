'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { zh } from '@/locales/zh-CN';
import { en } from '@/locales/en';
import { bn } from '@/locales/bn';
import { hi } from '@/locales/hi';
import { ur } from '@/locales/ur';
import type { Dict } from '@/locales/zh-CN';

// 已完整翻译:zh / en / bn / hi / ur(v1.1 四语补齐)
// - zh 是 schema 全集,en 是次全集
// - bn / hi / ur 继承 en 全集,本地化覆盖关键文案
// - 字典结构变更时优先在 zh-CN.ts 加 key,en 同步;bn/hi/ur 自动继承

export type Lang = 'zh' | 'en' | 'bn' | 'hi' | 'ur';

const DICT: Record<Lang, Dict> = {
  zh: zh,
  en: en,
  bn: bn as Dict,
  hi: hi as Dict,
  ur: ur as Dict,
};
const HTML_LANG: Record<Lang, string> = {
  zh: 'zh-CN', en: 'en', bn: 'bn', hi: 'hi', ur: 'ur',
};
const HTML_DIR: Record<Lang, 'ltr' | 'rtl'> = {
  zh: 'ltr', en: 'ltr', bn: 'ltr', hi: 'ltr', ur: 'rtl', // ur 唯一 RTL
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
  isPlaceholder: boolean;
  dark: boolean;
  setDark: (b: boolean) => void;
};
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('zh');
  const [dark, setDark] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('matoo.lang');
    if (saved && ['zh', 'en', 'bn', 'hi', 'ur'].includes(saved)) {
      setLangState(saved as Lang);
    }
    const themeSaved = window.localStorage.getItem('matoo.theme');
    if (themeSaved === 'dark') setDark(true);
    else if (themeSaved === 'light') setDark(false);
    else {
      // 跟随系统
      setDark(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = HTML_LANG[lang];
      document.documentElement.dir = HTML_DIR[lang];
      document.documentElement.classList.toggle('dark', dark);
    }
  }, [lang, dark]);

  const value = useMemo<Ctx & { dark: boolean; setDark: (b: boolean) => void }>(() => {
    // v1.1:四语已完整,不再有 placeholder 概念;统一从 DICT 查表
    const base = DICT[lang];
    return {
      lang,
      setLang: (l: Lang) => {
        setLangState(l);
        if (typeof window !== 'undefined') window.localStorage.setItem('matoo.lang', l);
      },
      t: base,
      isPlaceholder: false, // v1.1:四语均完整
      dark,
      setDark: (b: boolean) => {
        setDark(b);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('matoo.theme', b ? 'dark' : 'light');
          document.documentElement.classList.toggle('dark', b);
        }
      },
    };
  }, [lang, dark]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('useT must be used within I18nProvider');
  return ctx;
}

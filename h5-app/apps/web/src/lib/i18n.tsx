'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { zh } from '@/locales/zh-CN';
import { en } from '@/locales/en';
import { bn } from '@/locales/bn';
import { hi } from '@/locales/hi';
import { ur } from '@/locales/ur';
import type { Dict } from '@/locales/zh-CN';

// 已完整翻译：zh + en
// 占位翻译：bn / hi / ur（fallback 到 en，附 language marker）
// 生产期由专业译员填充完整字典。

export type Lang = 'zh' | 'en' | 'bn' | 'hi' | 'ur';

const FULL: Record<'zh' | 'en', Dict> = { zh, en };
const PLACEHOLDER: Record<'bn' | 'hi' | 'ur', Dict> = {
  bn: bn as Dict,
  hi: hi as Dict,
  ur: ur as Dict,
};
const HTML_LANG: Record<Lang, string> = {
  zh: 'zh-CN', en: 'en', bn: 'bn', hi: 'hi', ur: 'ur',
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
  isPlaceholder: boolean;
};
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('zh');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('matoo.lang') : null;
    if (saved && ['zh', 'en', 'bn', 'hi', 'ur'].includes(saved)) {
      setLangState(saved as Lang);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = HTML_LANG[lang];
    }
  }, [lang]);

  const value = useMemo<Ctx>(() => {
    const isPlaceholder = lang !== 'zh' && lang !== 'en';
    const base = isPlaceholder ? PLACEHOLDER[lang as 'bn' | 'hi' | 'ur'] : FULL[lang as 'zh' | 'en'];
    return {
      lang,
      setLang: (l: Lang) => {
        setLangState(l);
        if (typeof window !== 'undefined') window.localStorage.setItem('matoo.lang', l);
      },
      t: base,
      isPlaceholder,
    };
  }, [lang]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('useT must be used within I18nProvider');
  return ctx;
}
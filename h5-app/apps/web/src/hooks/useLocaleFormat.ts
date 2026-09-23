'use client';
// useLocaleFormat:基于当前 i18n lang 返回 locale 数字/货币/日期格式化函数
// zh → zh-CN;en → en-US;bn → bn-BD;hi → hi-IN;ur → ur-PK

import { useMemo } from 'react';
import { useT } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

const LANG_TO_BCP47: Record<Lang, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  bn: 'bn-BD',
  hi: 'hi-IN',
  ur: 'ur-PK',
};

const CCY_BY_COUNTRY: Record<string, string> = {
  BD: 'BDT',
  IN: 'INR',
  PK: 'PKR',
  LK: 'LKR',
  NP: 'NPR',
};

export type LocaleFormat = {
  locale: string;
  formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => string;
  formatCurrency: (n: number, currency?: string, opts?: Intl.NumberFormatOptions) => string;
  formatDate: (d: string | Date, opts?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (d: string | Date) => string;
};

export function useLocaleFormat(): LocaleFormat {
  const { lang } = useT();

  return useMemo(() => {
    const locale = LANG_TO_BCP47[lang];

    function formatNumber(n: number, opts: Intl.NumberFormatOptions = {}): string {
      try {
        return new Intl.NumberFormat(locale, opts).format(n);
      } catch {
        return String(n);
      }
    }

    function formatCurrency(n: number, currency = 'USD', opts: Intl.NumberFormatOptions = {}): string {
      try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency, ...opts }).format(n);
      } catch {
        return `${currency} ${n.toFixed(2)}`;
      }
    }

    function formatDate(d: string | Date, opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' }): string {
      try {
        const date = typeof d === 'string' ? new Date(d) : d;
        return new Intl.DateTimeFormat(locale, opts).format(date);
      } catch {
        return typeof d === 'string' ? d : d.toISOString().slice(0, 10);
      }
    }

    function formatDateTime(d: string | Date): string {
      return formatDate(d, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    return { locale, formatNumber, formatCurrency, formatDate, formatDateTime };
  }, [lang]);
}

/** 工具:把国家码 → 货币码 */
export function countryToCurrency(countryCode: string): string {
  return CCY_BY_COUNTRY[countryCode] ?? 'USD';
}
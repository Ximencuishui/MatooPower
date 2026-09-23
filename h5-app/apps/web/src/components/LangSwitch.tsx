'use client';
import { useT } from '@/lib/i18n';

const LANGS: Array<{ key: 'zh' | 'en' | 'bn' | 'hi' | 'ur'; label: string; code: string }> = [
  { key: 'zh', label: '中', code: 'zh' },
  { key: 'en', label: 'EN', code: 'en' },
  { key: 'bn', label: 'বাং', code: 'bn' },
  { key: 'hi', label: 'हिं', code: 'hi' },
  { key: 'ur', label: 'اردو', code: 'ur' },
];

export function LangSwitch() {
  const { lang, setLang, isPlaceholder } = useT();
  return (
    <div className="flex items-center gap-0.5 text-[11px]" role="group" aria-label="language">
      {LANGS.map((l) => {
        const active = lang === l.key;
        return (
          <button
            key={l.key}
            onClick={() => setLang(l.key)}
            aria-pressed={active}
            title={`${l.code}${active && l.key !== 'zh' && l.key !== 'en' ? ' (placeholder)' : ''}`}
            className={`px-1.5 py-1 rounded ${
              active ? 'bg-matoo-light text-matoo-dark font-semibold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100'
            }`}
          >
            {l.label}
          </button>
        );
      })}
      {isPlaceholder && <span className="ml-1 text-[9px] text-amber-600">β</span>}
    </div>
  );
}
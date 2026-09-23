'use client';
// v1.3 P0:多语言 + 文档类型 chip 多选组件

export const LANG_OPTIONS = [
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'bn', label: 'বাংলা', flag: '🇧🇩' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ur', label: 'اردو', flag: '🇵🇰' },
] as const;

export const DOC_TYPE_OPTIONS = [
  { code: 'manual', label: '说明书', icon: '📕' },
  { code: 'video', label: '安装视频', icon: '▶' },
  { code: 'specsheet', label: '规格书', icon: '📄' },
  { code: 'faq', label: 'FAQ', icon: '❓' },
] as const;

interface LangChipsProps {
  selected: string;
  onChange: (code: string) => void;
}

export function LangChips({ selected, onChange }: LangChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="选择语言">
      {LANG_OPTIONS.map((opt) => (
        <button
          key={opt.code}
          type="button"
          onClick={() => onChange(opt.code)}
          role="radio"
          aria-checked={selected === opt.code}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
            selected === opt.code
              ? 'bg-matoo text-white border-matoo'
              : 'bg-white text-slate-600 border-slate-200 hover:border-matoo/40'
          }`}
        >
          <span aria-hidden="true">{opt.flag}</span> {opt.label}
        </button>
      ))}
    </div>
  );
}

interface DocTypeChipsProps {
  selected: string;
  onChange: (code: string) => void;
}

export function DocTypeChips({ selected, onChange }: DocTypeChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="选择文档类型">
      {DOC_TYPE_OPTIONS.map((opt) => (
        <button
          key={opt.code}
          type="button"
          onClick={() => onChange(opt.code)}
          role="radio"
          aria-checked={selected === opt.code}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
            selected === opt.code
              ? 'bg-matoo text-white border-matoo'
              : 'bg-white text-slate-600 border-slate-200 hover:border-matoo/40'
          }`}
        >
          <span aria-hidden="true" className="mr-1">{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
'use client';
// 统一空状态视觉规范:插画 + 标题 + 提示 + CTA
import Link from 'next/link';

export function EmptyState({
  icon = '📦',
  title,
  hint,
  ctaLabel,
  ctaHref,
  size = 'md',
}: {
  icon?: string;
  title: string;
  hint?: string;
  ctaLabel?: string;
  ctaHref?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const pad = size === 'sm' ? 'p-4' : size === 'lg' ? 'p-10' : 'p-8';
  const iconSize = size === 'sm' ? 'text-3xl' : size === 'lg' ? 'text-6xl' : 'text-4xl';
  return (
    <div className={`card ${pad} text-center text-slate-500 dark:text-slate-400 flex flex-col items-center gap-2`}>
      <div aria-hidden="true" className={iconSize}>{icon}</div>
      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</div>
      {hint && <div className="text-xs opacity-80 max-w-xs">{hint}</div>}
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-2 text-xs px-4 py-2 rounded-md bg-matoo text-white font-medium hover:bg-matoo-dark"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

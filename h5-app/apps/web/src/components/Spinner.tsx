'use client';
// 轻量零依赖 Spinner + SkeletonBlock,统一 loading 视觉规范
import { useT } from '@/lib/i18n';

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 14 : size === 'lg' ? 28 : 20;
  return (
    <span
      role="status"
      aria-label="loading"
      className="inline-block animate-spin"
      style={{ width: dim, height: dim }}
    >
      <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** 页面级 loading:居中 spinner + 文案 */
export function PageLoading({ hint }: { hint?: string }) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-8 text-slate-400 dark:text-slate-500 text-sm">
      <Spinner size="lg" />
      {hint ?? t.common.loading}
    </div>
  );
}

/** Skeleton 块(灰底脉动),用于设备卡 / 工单卡占位 */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/50 ${className}`}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="card p-4 space-y-2">
      <SkeletonBlock className="h-4 w-1/2" />
      <SkeletonBlock className="h-3 w-2/3" />
      <SkeletonBlock className="h-3 w-1/3" />
    </div>
  );
}

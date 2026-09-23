// 简单的加载占位 + spinner
'use client';

export function PageLoading({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
      <svg
        className="animate-spin h-6 w-6 text-matoo"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.25"
        />
        <path
          d="M22 12a10 10 0 0 1-10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-3 text-sm">{label}</div>
    </div>
  );
}
'use client';

// T6 全局错误捕获：React rendering 错误（SSR + 客户端）→ Sentry.captureException
// - Next.js App Router 用 app/global-error.tsx 作为根 layout 异常时的兜底 UI
// - DSN 为空时 Sentry.captureException 是 no-op，无需额外判断
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center text-slate-800">
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold">页面出错了</h1>
          <p className="text-sm text-slate-600">请刷新重试，或稍后再来。</p>
          {reset ? (
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              重试
            </button>
          ) : null}
        </div>
      </body>
    </html>
  );
}
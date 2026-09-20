'use client';
// 统一错误展示 + 重试 + 登录跳转;11 处错误态替换
import Link from 'next/link';
import { useT } from '@/lib/i18n';
import { ApiError } from '@/lib/api/client';

type Variant = 'card' | 'inline';

export function ErrorBlock({
  error,
  onRetry,
  retryLabel,
  showLoginLink = false,
  loginNext,
  variant = 'card',
}: {
  error: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  /** 当 401 时显示"去登录"链接;需配合 loginNext */
  showLoginLink?: boolean;
  loginNext?: string;
  variant?: Variant;
}) {
  const { t } = useT();

  const isAuth = error instanceof ApiError && (error.status === 401 || error.status === 403);
  const isNetwork = !(
    error instanceof ApiError ||
    (error instanceof Error && error.name === 'ApiError')
  );
  const message =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
      ? error.message
      : t.common.networkErr;

  const cls =
    variant === 'card'
      ? 'card p-4 text-sm'
      : 'p-3 rounded-xl';

  return (
    <div role="alert" className={`${cls} text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300 space-y-2`}>
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="text-base leading-none mt-0.5">⚠</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium">
            {isAuth ? t.errors.unauthorized : isNetwork ? t.common.networkErr : t.common.loadFailed}
          </div>
          <div className="text-xs opacity-80 mt-0.5 break-words">{message}</div>
        </div>
      </div>
      {(onRetry || (isAuth && showLoginLink)) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-xs px-3 py-1.5 rounded-md bg-matoo text-white font-medium hover:bg-matoo-dark"
            >
              {retryLabel ?? t.common.retry}
            </button>
          )}
          {isAuth && showLoginLink && (
            <Link
              href={`/auth${loginNext ? `?next=${encodeURIComponent(loginNext)}` : ''}`}
              className="text-xs px-3 py-1.5 rounded-md border border-matoo text-matoo font-medium hover:bg-matoo-light dark:hover:bg-matoo-dark/30"
            >
              {t.common.goLogin}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

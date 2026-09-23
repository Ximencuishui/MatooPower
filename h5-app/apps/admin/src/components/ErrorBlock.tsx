'use client';

import { ApiError } from '@/lib/api/client';

interface Props {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}

function describe(e: unknown): { title: string; desc: string } {
  if (e instanceof ApiError) {
    if (e.status === 401)
      return { title: '未登录', desc: '请用 admin 账号登录后再访问此页面。' };
    if (e.status === 403)
      return { title: '无访问权限', desc: e.message || '当前角色无权访问此资源。' };
    if (e.status === 404)
      return { title: '资源不存在', desc: e.message || '请确认 URL 是否有效。' };
    if (e.status === 429)
      return { title: '请求过于频繁', desc: e.message || '请稍后再试。' };
    return { title: `错误 ${e.status}`, desc: e.message };
  }
  if (e instanceof Error) return { title: '请求失败', desc: e.message };
  return { title: '请求失败', desc: '请稍后重试。' };
}

export function ErrorBlock({ error, onRetry, title }: Props) {
  const info = describe(error);
  return (
    <div className="card p-6 my-6 border-rose-200 bg-rose-50/40">
      <div className="text-sm font-semibold text-rose-700">
        {title ?? info.title}
      </div>
      <div className="mt-1 text-xs text-slate-600">{info.desc}</div>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-3">
          重试
        </button>
      )}
    </div>
  );
}
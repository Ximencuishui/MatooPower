// Admin 桌面端角色守卫 hook（极简版,无 i18n 复杂度）
// - 状态机：'loading' | 'unauthenticated' | 'forbidden' | 'ok'
// - 守卫未通过时由页面渲染 RoleGuardView 提示用户登录或提示权限不足
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useSession } from './auth-store';

export type RoleGuardState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'forbidden'; role: string }
  | { status: 'ok'; role: string };

export function useRequireRole(allowed: Array<'admin' | 'dealer' | 'customer'>) {
  const session = useSession();
  const router = useRouter();

  const state: RoleGuardState =
    session === null
      ? { status: 'loading' }
      : !session.token
        ? { status: 'unauthenticated' }
        : !allowed.includes(session.user.role)
          ? { status: 'forbidden', role: session.user.role }
          : { status: 'ok', role: session.user.role };

  useEffect(() => {
    if (state.status === 'unauthenticated') {
      const t = setTimeout(() => router.push('/auth?next=/admin/overview'), 500);
      return () => clearTimeout(t);
    }
  }, [state.status, router]);

  return state;
}

export function RoleGuardView({ state, title }: { state: RoleGuardState; title: string }) {
  if (state.status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        正在校验登录状态…
      </div>
    );
  }
  if (state.status === 'unauthenticated') {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        即将跳转登录…
      </div>
    );
  }
  if (state.status === 'forbidden') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="text-2xl font-semibold mb-2">403 · 无访问权限</div>
        <p className="text-slate-500 text-sm">
          当前角色 <code className="font-mono text-rose-600">{state.role}</code> 无法访问{' '}
          <code className="font-mono">{title}</code>。请用 admin 账号登录。
        </p>
      </div>
    );
  }
  return null as unknown as ReactNode;
}
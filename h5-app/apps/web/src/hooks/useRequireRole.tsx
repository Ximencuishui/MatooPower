'use client';
// useRequireRole:守卫客户端路由,防止未授权角色访问
// - 已登录但角色不匹配:显示 403 卡片(可退出)
// - 未登录:显示登录入口卡片
// - 角色匹配:返回 null 让页面正常渲染

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { LangSwitch } from '@/components/LangSwitch';
import { useT } from '@/lib/i18n';
import { getSession, type AuthSession } from '@/lib/api/auth-store';
import { clearSession } from '@/lib/api/auth-store';

type Role = 'customer' | 'dealer' | 'admin' | 'support';

export type RoleGuardState =
  | { status: 'checking' }
  | { status: 'ok'; session: AuthSession }
  | { status: 'need-login' }
  | { status: 'forbidden'; session: AuthSession; allowed: Role[] };

export function useRequireRole(allowed: Role[]): RoleGuardState {
  const [state, setState] = useState<RoleGuardState>({ status: 'checking' });

  useEffect(() => {
    const s = getSession();
    if (!s?.token) {
      setState({ status: 'need-login' });
      return;
    }
    if (!allowed.includes(s.role as Role)) {
      setState({ status: 'forbidden', session: s, allowed });
      return;
    }
    setState({ status: 'ok', session: s });
  }, [allowed.join(',')]);

  return state;
}

export function RoleGuardView({
  state, title,
}: { state: RoleGuardState; title: string }) {
  const { t } = useT();

  if (state.status === 'checking') {
    return (
      <PhoneShell>
        <TopBar title={title} right={<LangSwitch />} />
        <main className="p-5 text-slate-400 dark:text-slate-500 text-sm">…</main>
      </PhoneShell>
    );
  }

  if (state.status === 'need-login') {
    return (
      <PhoneShell>
        <TopBar title={title} right={<LangSwitch />} />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="card p-6 text-center space-y-3 max-w-sm">
            <div aria-hidden="true" className="text-4xl">🔐</div>
            <h2 className="text-base font-semibold">{t.auth.needLogin}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.common.loginRequiredHint}</p>
            <Link href={`/auth?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`} className="btn-primary inline-flex items-center justify-center">
              {t.common.goLogin}
            </Link>
          </div>
        </main>
      </PhoneShell>
    );
  }

  if (state.status === 'forbidden') {
    const roles = state.allowed.join(' / ');
    return (
      <PhoneShell>
        <TopBar title={title} right={<LangSwitch />} />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="card p-6 text-center space-y-3 max-w-sm border-red-100 dark:border-red-900">
            <div aria-hidden="true" className="text-4xl">⛔</div>
            <h2 className="text-base font-semibold">403 · 无权访问</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              当前角色 <span className="font-mono">{state.session.role}</span> 不允许访问此页面。
              <br />需要:<span className="font-mono">{roles}</span>
            </p>
            <div className="flex gap-2">
              <Link href="/home" className="btn-secondary">返回首页</Link>
              <button
                onClick={() => { void clearSession(); if (typeof window !== 'undefined') window.location.href = '/auth'; }}
                className="btn-ghost text-sm"
              >
                {t.common.logout}
              </button>
            </div>
          </div>
        </main>
      </PhoneShell>
    );
  }

  return null;
}
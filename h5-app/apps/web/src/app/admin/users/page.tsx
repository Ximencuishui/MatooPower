'use client';
// P1-10:管理员用户列表页 — 角色过滤 + 搜索 + 详情 Drawer
// 列出全部注册用户，支持按角色过滤、按手机/邮箱/名称搜索

import { useEffect, useMemo, useState } from 'react';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar, AdminBreadcrumb } from '@/components/TopBar';
import { LangSwitch } from '@/components/LangSwitch';
import { PageLoading } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { Drawer } from '@/components/Drawer';
import { useT } from '@/lib/i18n';
import { listAdminUsers, downloadAdminUsersCsv } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { useRequireRole, RoleGuardView } from '@/hooks/useRequireRole';
import { useAbortedFetch } from '@/hooks/useAbortedFetch';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import type { AdminUserItem } from '@/lib/api/endpoints';

type RoleFilter = 'all' | 'customer' | 'dealer' | 'admin';

const ROLE_LABEL: Record<RoleFilter, string> = {
  all: '全部',
  customer: '客户',
  dealer: '经销商',
  admin: '管理员',
};

const ROLE_CHIP: Record<Exclude<RoleFilter, 'all'>, string> = {
  customer: 'chip-blue',
  dealer: 'chip-purple',
  admin: 'chip-red',
};

export default function AdminUsersPage() {
  const { t: _t } = useT();
  const { formatDate, formatNumber } = useLocaleFormat();
  const guard = useRequireRole(['admin']);

  const [role, setRole] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<AdminUserItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<AdminUserItem | null>(null);
  const [error, setError] = useState<unknown>(null);
  // P0 UX-10:onRetry 时通过递增 reloadKey 触发重新 fetch
  const [reloadKey, setReloadKey] = useState(0);

  // 搜索 debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // AbortController: 切换 tab/搜索/手动重试时取消上一次的 fetch
  useAbortedFetch((signal) => {
    if (guard.status !== 'ok') return;
    setError(null);
    listAdminUsers(
      {
        role: role === 'all' ? undefined : role,
        q: debouncedSearch.trim() || undefined,
        pageSize: 100,
      },
      { signal },
    )
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
  }, [role, debouncedSearch, guard.status, reloadKey]);

  // 角色分组统计
  const groupedCounts = useMemo(() => {
    const m: Record<string, number> = { customer: 0, dealer: 0, admin: 0 };
    (items ?? []).forEach((u) => { m[u.role] = (m[u.role] ?? 0) + 1; });
    return m;
  }, [items]);

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title="用户管理" />;
  }

  return (
    <PhoneShell>
      <TopBar
        title="用户管理"
        leftExtra={<AdminBreadcrumb />}
        right={
          <>
            <ExportCsvButton
              filename={`admin-users-${new Date().toISOString().slice(0, 10)}`}
              fetch={() => downloadAdminUsersCsv(debouncedSearch, role === 'all' ? undefined : role)}
              count={items?.length ?? 0}
            />
            <LangSwitch />
          </>
        }
      />

      <main className="flex-1 overflow-auto pb-6">
        {/* 总览 + 角色分布 */}
        <section className="px-4 mt-3">
          <div className="card p-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>用户总数</span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {formatNumber(total)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {(['customer', 'dealer', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`rounded-lg p-2 text-center text-[11px] transition ${
                    role === r
                      ? 'bg-matoo-light dark:bg-slate-700 ring-1 ring-matoo'
                      : 'bg-slate-50 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="text-slate-500 dark:text-slate-400">{ROLE_LABEL[r]}</div>
                  <div className="text-base font-semibold mt-0.5">{groupedCounts[r] ?? 0}</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 搜索 + Tab */}
        <div className="px-4 mt-3">
          <form onSubmit={(e) => e.preventDefault()} className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索手机号 / 邮箱 / 名称"
              dir="auto"
              className="input pr-9"
              aria-label="search users"
            />
            <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">?</span>
          </form>
        </div>

        <div className="px-4 mt-2">
          <div role="tablist" className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            {(Object.keys(ROLE_LABEL) as RoleFilter[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={role === k}
                onClick={() => setRole(k)}
                className={`flex-1 py-2 rounded-lg ${role === k ? 'bg-white dark:bg-slate-800 shadow-sm font-semibold' : 'text-slate-500'}`}
              >
                {ROLE_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <section className="px-4 mt-3 space-y-2">
          {error != null && !items && (
            <ErrorBlock
              error={error}
              onRetry={() => setReloadKey((k) => k + 1)}
              showLoginLink={error instanceof ApiError && error.status === 401}
              loginNext="/admin/users"
            />
          )}
          {!error && !items && <PageLoading />}
          {!error && items && items.length === 0 && (
            <EmptyState icon="??" title="暂无用户" />
          )}
          {items?.map((u) => (
            <button key={u.id} onClick={() => setSelected(u)} className="card p-3 w-full text-left">
              <div className="flex items-start gap-2">
                <div className="w-9 h-9 rounded-full bg-matoo-light dark:bg-slate-700 flex items-center justify-center text-matoo-dark dark:text-matoo-light text-sm font-semibold flex-shrink-0">
                  {(u.displayName ?? u.phone ?? u.email ?? '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {u.displayName ?? u.phone ?? u.email ?? u.id}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                    {u.phone && <span className="font-mono">{u.phone}</span>}
                    {u.phone && u.email && ' · '}
                    {u.email && <span>{u.email}</span>}
                    {!u.phone && !u.email && <span className="text-slate-400 dark:text-slate-500">未绑定联系方式</span>}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {formatDate(u.createdAt)} · 保修 {u.warrantyCount} 件
                  </div>
                </div>
                <span className={`chip text-[10px] ${ROLE_CHIP[u.role as Exclude<RoleFilter, 'all'>] ?? 'chip-gray'}`}>
                  {ROLE_LABEL[u.role as RoleFilter] ?? u.role}
                </span>
              </div>
            </button>
          ))}
        </section>
      </main>

      {/* 详情 Drawer */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title="用户详情">
        {selected && (
          <div className="p-4 space-y-4">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-matoo-light dark:bg-slate-700 flex items-center justify-center text-matoo-dark dark:text-matoo-light text-lg font-semibold">
                {(selected.displayName ?? selected.phone ?? selected.email ?? '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">
                  {selected.displayName ?? '匿名用户'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                  {selected.id}
                </div>
              </div>
              <span className={`chip ${ROLE_CHIP[selected.role as Exclude<RoleFilter, 'all'>] ?? 'chip-gray'}`}>
                {ROLE_LABEL[selected.role as RoleFilter] ?? selected.role}
              </span>
            </div>

            <div className="card p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">手机号</span>
                <span className="font-mono">{selected.phone ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">邮箱</span>
                <span className="truncate max-w-[60%]">{selected.email ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">注册时间</span>
                <span>{formatDate(selected.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">激活保修</span>
                <span className="font-semibold">{selected.warrantyCount} 件</span>
              </div>
            </div>

            {/* 操作区(占位:实际功能需后端接口支持) */}
            <div className="card p-4 space-y-2 text-sm">
              <h4 className="font-semibold text-sm">管理员操作</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                调整用户角色、停用账号、查看保修历史等功能需后端
                <code className="font-mono mx-1">PATCH /admin/users/:id/role</code>
                <code className="font-mono mx-1">DELETE /admin/users/:id</code>
                等接口上线后开放。当前为只读列表。
              </p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button disabled className="btn-secondary text-sm opacity-50 cursor-not-allowed">
                  修改角色
                </button>
                <button disabled className="btn-ghost text-red-600 dark:text-red-400 text-sm opacity-50 cursor-not-allowed">
                  停用账号
                </button>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </PhoneShell>
  );
}
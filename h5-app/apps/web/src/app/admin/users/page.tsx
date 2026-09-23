'use client';
// P1-10 + v1.4 P1-1:管理员用户列表页 — 角色过滤 + 搜索 + 详情 Drawer + GDPR 删除
// 列出全部注册用户，支持按角色过滤、按手机/邮箱/名称搜索
// 已删用户(phone/email 已置 NULL)从列表中过滤；GDPR 删除走二次确认

import { useEffect, useMemo, useState } from 'react';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar, AdminBreadcrumb } from '@/components/TopBar';
import { LangSwitch } from '@/components/LangSwitch';
import { PageLoading } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { Drawer } from '@/components/Drawer';
import { Confirm } from '@/components/Confirm';
import { useT } from '@/lib/i18n';
import { listAdminUsers, downloadAdminUsersCsv, gdprDeleteAdminUser } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { useRequireRole, RoleGuardView } from '@/hooks/useRequireRole';
import { useAbortedFetch } from '@/hooks/useAbortedFetch';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { toastError, toastSuccess } from '@/components/Toast';
import { getSession } from '@/lib/api/auth-store';
import type { AdminUserItem } from '@/lib/api/endpoints';

type RoleFilter = 'all' | 'customer' | 'dealer' | 'admin' | 'support';

const ROLE_CHIP: Record<Exclude<RoleFilter, 'all'>, string> = {
  customer: 'chip-blue',
  dealer: 'chip-purple',
  admin: 'chip-red',
  support: 'chip-green',
};

export default function AdminUsersPage() {
  const { t } = useT();
  const { formatDate, formatNumber } = useLocaleFormat();
  const guard = useRequireRole(['admin']);
  const session = getSession();

  const [role, setRole] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<AdminUserItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<AdminUserItem | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // 搜索 debounce 300ms
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

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
    const m: Record<string, number> = { customer: 0, dealer: 0, admin: 0, support: 0 };
    (items ?? []).forEach((u) => { m[u.role] = (m[u.role] ?? 0) + 1; });
    return m;
  }, [items]);

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title={t.adminUsers.title} />;
  }

  const handleGdpr = async (id: string) => {
    try {
      const r = await gdprDeleteAdminUser(id);
      toastSuccess(`${t.common.gdprSuccess} · ${id.slice(0, 8)}…`);
      setSelected(null);
      setReloadKey((k) => k + 1);
      return r;
    } catch (e) {
      const msg = e instanceof ApiError
        ? `${t.common.gdprFailed}: ${e.message}`
        : t.common.gdprFailed;
      toastError(msg);
      throw e;
    }
  };

  return (
    <PhoneShell>
      <TopBar
        title={t.adminUsers.title}
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
              <span>{t.adminUsers.total}</span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {formatNumber(total)}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {(['customer', 'dealer', 'admin', 'support'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`rounded-lg p-2 text-center text-[11px] transition ${
                    role === r
                      ? 'bg-matoo-light dark:bg-slate-700 ring-1 ring-matoo'
                      : 'bg-slate-50 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="text-slate-500 dark:text-slate-400">{t.adminUsers[`role_${r}` as const]}</div>
                  <div className="text-base font-semibold mt-0.5">{groupedCounts[r] ?? 0}</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 搜索 */}
        <div className="px-4 mt-3">
          <form onSubmit={(e) => e.preventDefault()} className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.adminUsers.searchPh}
              dir="auto"
              className="input pr-9"
              aria-label="search users"
            />
            <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">?</span>
          </form>
        </div>

        <div className="px-4 mt-2">
          <div role="tablist" className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            <button
              role="tab"
              aria-selected={role === 'all'}
              onClick={() => setRole('all')}
              className={`flex-1 py-2 rounded-lg ${role === 'all' ? 'bg-white dark:bg-slate-800 shadow-sm font-semibold' : 'text-slate-500'}`}
            >
              {t.adminUsers.role_all}
            </button>
            {(['customer', 'dealer', 'admin', 'support'] as const).map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={role === r}
                onClick={() => setRole(r)}
                className={`flex-1 py-2 rounded-lg ${role === r ? 'bg-white dark:bg-slate-800 shadow-sm font-semibold' : 'text-slate-500'}`}
              >
                {t.adminUsers[`role_${r}` as const]}
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
            <EmptyState icon="👥" title={t.adminUsers.empty} />
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
                    {!u.phone && !u.email && <span className="text-slate-400 dark:text-slate-500">{t.adminUsers.noContact}</span>}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {formatDate(u.createdAt)} · {t.adminUsers.warrantyCountLabel} {u.warrantyCount}
                  </div>
                </div>
                <span className={`chip text-[10px] ${ROLE_CHIP[u.role as Exclude<RoleFilter, 'all'>] ?? 'chip-gray'}`}>
                  {t.adminUsers[`role_${u.role}` as keyof typeof t.adminUsers] ?? u.role}
                </span>
              </div>
            </button>
          ))}
        </section>
      </main>

      {/* 详情 Drawer */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={t.adminUsers.detailTitle}>
        {selected && (
          <div className="p-4 space-y-4">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-matoo-light dark:bg-slate-700 flex items-center justify-center text-matoo-dark dark:text-matoo-light text-lg font-semibold">
                {(selected.displayName ?? selected.phone ?? selected.email ?? '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">
                  {selected.displayName ?? 'Anonymous'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                  {selected.id}
                </div>
              </div>
              <span className={`chip ${ROLE_CHIP[selected.role as Exclude<RoleFilter, 'all'>] ?? 'chip-gray'}`}>
                {t.adminUsers[`role_${selected.role}` as keyof typeof t.adminUsers] ?? selected.role}
              </span>
            </div>

            <div className="card p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{t.adminUsers.phoneLabel}</span>
                <span className="font-mono">{selected.phone ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{t.adminUsers.emailLabel}</span>
                <span className="truncate max-w-[60%]">{selected.email ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{t.adminUsers.createdAtLabel}</span>
                <span>{formatDate(selected.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{t.adminUsers.warrantyCountLabel}</span>
                <span className="font-semibold">{selected.warrantyCount}</span>
              </div>
            </div>

            {/* 操作区 */}
            <div className="card p-4 space-y-3 text-sm">
              <h4 className="font-semibold text-sm">{t.adminUsers.actionSection}</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {t.adminUsers.actionHint}
              </p>
              <div className="grid grid-cols-1 gap-2 mt-2">
                <Confirm
                  destructive
                  trigger={(open) => (
                    <button
                      onClick={open}
                      disabled={session?.userId === selected.id}
                      className="btn-ghost text-red-600 dark:text-red-400 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      title={session?.userId === selected.id ? t.common.gdprForbiddenSelf : ''}
                    >
                      {t.adminUsers.gdprBtn}
                    </button>
                  )}
                  title={t.common.gdprConfirmTitle}
                  description={t.common.gdprConfirmBody}
                  confirmLabel={t.common.gdprBtn}
                  onConfirm={() => handleGdpr(selected.id)}
                />
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </PhoneShell>
  );
}
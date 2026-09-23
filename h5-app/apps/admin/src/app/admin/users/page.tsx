// Admin 用户管理 — 桌面端表格
'use client';

import { useEffect, useMemo, useState } from 'react';
import { listUsers, type AdminUserItem } from '@/lib/api/operations';
import { useRequireRole, RoleGuardView } from '@/lib/useRequireRole';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { UserDetailDrawer } from '@/components/drawers/UserDetailDrawer';

const ROLE_LABEL = { customer: '客户', dealer: '经销商', admin: '管理员' } as const;
const ROLE_CHIP = { customer: 'chip-blue', dealer: 'chip-purple', admin: 'chip-red' } as const;

type RoleFilter = 'all' | 'customer' | 'dealer' | 'admin';

export default function AdminUsersPage() {
  const guard = useRequireRole(['admin']);
  const [role, setRole] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [items, setItems] = useState<AdminUserItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (guard.status !== 'ok') return;
    const ac = new AbortController();
    setError(null);
    listUsers(
      {
        role: role === 'all' ? undefined : role,
        q: debounced.trim() || undefined,
        pageSize: 200,
      },
      ac.signal,
    )
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
    return () => ac.abort();
  }, [role, debounced, guard.status, reloadKey]);

  const grouped = useMemo(() => {
    const m: Record<string, number> = { customer: 0, dealer: 0, admin: 0 };
    (items ?? []).forEach((u) => {
      m[u.role] = (m[u.role] ?? 0) + 1;
    });
    return m;
  }, [items]);

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title="用户管理" />;
  }

  return (
    <div className="px-8 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="text-sm text-slate-500 mt-1">共 {total} 个用户</p>
        </div>
        <button onClick={() => setReloadKey((k) => k + 1)} className="btn-secondary">
          刷新
        </button>
      </header>

      {/* 搜索 + 角色筛选 */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索手机号 / 邮箱 / 名称"
          className="input max-w-sm"
        />
        <div role="tablist" className="flex bg-slate-100 p-1 rounded-xl text-sm">
          {(['all', 'customer', 'dealer', 'admin'] as RoleFilter[]).map((k) => (
            <button
              key={k}
              onClick={() => setRole(k)}
              className={`px-3 py-1.5 rounded-lg transition ${
                role === k ? 'bg-white shadow-card font-semibold' : 'text-slate-500'
              }`}
            >
              {k === 'all' ? '全部' : ROLE_LABEL[k]}{' '}
              <span className="text-xs text-slate-400 ml-1">
                {k === 'all' ? total : grouped[k] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error !== null && !items && <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />}
      {!items && !error && <PageLoading />}
      {items && items.length === 0 && <EmptyState title="暂无用户" />}

      {items && items.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="table-th">用户</th>
                <th className="table-th">手机号</th>
                <th className="table-th">邮箱</th>
                <th className="table-th">角色</th>
                <th className="table-th">保修数</th>
                <th className="table-th">注册时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-slate-50/60 cursor-pointer"
                  onClick={() => setOpenId(u.id)}
                >
                  <td className="table-td">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-matoo-light text-matoo-dark flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {(u.displayName ?? u.phone ?? u.email ?? '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.displayName ?? '匿名用户'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{u.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="table-td font-mono text-xs">{u.phone ?? '—'}</td>
                  <td className="table-td text-xs truncate max-w-[200px]">{u.email ?? '—'}</td>
                  <td className="table-td">
                    <span className={`chip ${ROLE_CHIP[u.role] ?? 'chip-gray'}`}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="table-td font-semibold">{u.warrantyCount}</td>
                  <td className="table-td text-xs text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserDetailDrawer
        userId={openId}
        open={!!openId}
        onClose={() => setOpenId(null)}
        onChanged={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}
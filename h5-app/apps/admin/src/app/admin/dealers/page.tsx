// Admin 经销商管理（CRUD）—— 表格 + 创建 Drawer + 详情 Drawer
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  listDealers,
  createDealer,
  updateDealer,
  suspendDealer,
  activateDealer,
  type DealerItem,
  type DealerStatus,
  type DealerTier,
} from '@/lib/api/operations';
import { useRequireRole, RoleGuardView } from '@/lib/useRequireRole';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { DealerFormDrawer } from '@/components/drawers/DealerFormDrawer';
import { DealerDetailDrawer } from '@/components/drawers/DealerDetailDrawer';
import { useLocale } from '@/lib/useLocale';
import { getDict } from '@/lib/i18n';

const STATUS_OPTIONS: Array<{ key: DealerStatus | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '启用' },
  { key: 'suspended', label: '停用' },
];

const TIER_LABEL: Record<DealerTier, string> = {
  silver: '白银',
  gold: '黄金',
  platinum: '铂金',
};
const TIER_CHIP: Record<DealerTier, string> = {
  silver: 'chip-gray',
  gold: 'chip-blue',
  platinum: 'chip-purple',
};

export default function AdminDealersPage() {
  const guard = useRequireRole(['admin']);
  const { locale } = useLocale();
  const dict = getDict(locale);
  const [status, setStatus] = useState<DealerStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [items, setItems] = useState<DealerItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DealerItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (guard.status !== 'ok') return;
    const ac = new AbortController();
    setError(null);
    listDealers(
      {
        status: status === 'all' ? undefined : status,
        q: debounced.trim() || undefined,
        pageSize: 100,
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
  }, [status, debounced, guard.status, reloadKey]);

  const activeCount = useMemo(
    () => (items ?? []).filter((d) => d.status === 'active').length,
    [items],
  );

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title={dict.dealers.title} />;
  }

  function handleNewClick() {
    setEditing(null);
    setFormOpen(true);
  }

  function handleEditClick(d: DealerItem, e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(d);
    setFormOpen(true);
  }

  async function handleSuspendClick(d: DealerItem, e: React.MouseEvent) {
    e.stopPropagation();
    const action = d.status === 'active' ? '停用' : '启用';
    if (!confirm(`确认${action}经销商「${d.companyName}」？\n${action === '停用' ? '停用后该经销商将无法登录，其价格表保留但不再生效。' : '启用后该经销商可正常登录。'}`)) return;
    try {
      if (d.status === 'active') {
        await suspendDealer(d.id);
      } else {
        await activateDealer(d.id);
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      alert(`${action}失败: ` + (err as Error).message);
    }
  }

  function handleDetailClick(d: DealerItem, e: React.MouseEvent) {
    e.stopPropagation();
    setOpenId(d.id);
  }

  return (
    <div className="px-8 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{dict.dealers.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {dict.dealers.subtitle.replace('{total}', String(total))} ·{' '}
            <span className="text-emerald-600">启用 {activeCount}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setReloadKey((k) => k + 1)} className="btn-secondary">
            {dict.audit.refresh}
          </button>
          <button onClick={handleNewClick} className="btn-primary">
            + {dict.dealers.new}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={dict.dealers.search}
          className="input max-w-sm"
        />
        <div role="tablist" className="flex bg-slate-100 p-1 rounded-xl text-sm">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setStatus(opt.key)}
              className={`px-3 py-1.5 rounded-lg transition ${
                status === opt.key ? 'bg-white shadow-card font-semibold' : 'text-slate-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error !== null && !items && (
        <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      )}
      {!items && !error && <PageLoading />}
      {items && items.length === 0 && <EmptyState title={dict.common.empty} />}

      {items && items.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="table-th">公司</th>
                <th className="table-th">国家</th>
                <th className="table-th">等级</th>
                <th className="table-th">联系</th>
                <th className="table-th">状态</th>
                <th className="table-th">成员</th>
                <th className="table-th">创建</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr
                  key={d.id}
                  className="hover:bg-slate-50/60 cursor-pointer"
                  onClick={() => setOpenId(d.id)}
                >
                  <td className="table-td">
                    <div className="font-medium">{d.companyName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{d.id}</div>
                  </td>
                  <td className="table-td">
                    <span className="font-mono text-xs">{d.country}</span>
                  </td>
                  <td className="table-td">
                    <span className={`chip ${TIER_CHIP[d.tier]}`}>{TIER_LABEL[d.tier]}</span>
                  </td>
                  <td className="table-td">
                    <div className="text-xs">{d.contactEmail ?? '—'}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {d.contactPhone ?? '—'}
                    </div>
                  </td>
                  <td className="table-td">
                    <span
                      className={`chip ${
                        d.status === 'active' ? 'chip-green' : 'chip-red'
                      }`}
                    >
                      {d.status === 'active' ? '启用' : '停用'}
                    </span>
                  </td>
                  <td className="table-td text-sm">{d.memberCount ?? 0}</td>
                  <td className="table-td text-xs text-slate-500">
                    {new Date(d.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="table-td" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-3 text-xs">
                      <button
                        onClick={(e) => handleDetailClick(d, e)}
                        className="text-matoo hover:underline"
                      >
                        详情
                      </button>
                      <button
                        onClick={(e) => handleEditClick(d, e)}
                        className="text-matoo hover:underline"
                      >
                        编辑
                      </button>
                      <button
                        onClick={(e) => handleSuspendClick(d, e)}
                        className={d.status === 'active' ? 'text-rose-600 hover:underline' : 'text-emerald-600 hover:underline'}
                      >
                        {d.status === 'active' ? '停用' : '启用'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DealerDetailDrawer
        dealerId={openId}
        open={!!openId}
        onClose={() => setOpenId(null)}
        onChanged={() => setReloadKey((k) => k + 1)}
      />

      <DealerFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
        onSubmit={async (body) => {
          if (editing) {
            await updateDealer(editing.id, body);
          } else {
            await createDealer(body);
          }
          setReloadKey((k) => k + 1);
        }}
      />
    </div>
  );
}
// Admin 保修管理 — 桌面端表格 + 批量审批 + 单条详情 Drawer
'use client';

import { useEffect, useState } from 'react';
import {
  listWarranties,
  bulkReviewWarranties,
  type AdminWarrantyItem,
  type WarrantyReviewStatus,
} from '@/lib/api/operations';
import { useRequireRole, RoleGuardView } from '@/lib/useRequireRole';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { WarrantyDetailDrawer } from '@/components/drawers/WarrantyDetailDrawer';

type StatusFilter = 'all' | 'active' | 'pending' | 'review' | 'rejected' | 'expired';
const STATUS_LABEL: Record<StatusFilter, string> = {
  all: '全部',
  active: '激活',
  pending: '待审',
  review: '复审',
  rejected: '驳回',
  expired: '过期',
};
const STATUS_CHIP: Record<string, string> = {
  active: 'chip-green',
  pending: 'chip-orange',
  review: 'chip-purple',
  rejected: 'chip-red',
  expired: 'chip-gray',
};

export default function AdminWarrantiesPage() {
  const guard = useRequireRole(['admin']);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [items, setItems] = useState<AdminWarrantyItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<WarrantyReviewStatus>('active');
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulking, setBulking] = useState(false);

  useEffect(() => {
    if (guard.status !== 'ok') return;
    const ac = new AbortController();
    setError(null);
    listWarranties(
      { status: status === 'all' ? undefined : status, pageSize: 200 },
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
  }, [status, guard.status, reloadKey]);

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title="保修管理" />;
  }

  const allSelected = !!items && items.length > 0 && items.every((w) => selected.has(w.id));
  function toggleAll() {
    if (!items) return;
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((w) => w.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulk() {
    if (selected.size === 0 || bulking) return;
    setBulking(true);
    try {
      const res = await bulkReviewWarranties(
        Array.from(selected),
        bulkStatus,
        bulkNotes.trim() || undefined,
      );
      alert(`批量审批完成：成功 ${res.succeeded} 条，失败 ${res.failed} 条`);
      setSelected(new Set());
      setBulkNotes('');
      setReloadKey((k) => k + 1);
    } catch (e) {
      alert('批量审批失败: ' + (e as Error).message);
    } finally {
      setBulking(false);
    }
  }

  return (
    <div className="px-8 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">保修管理</h1>
          <p className="text-sm text-slate-500 mt-1">共 {total} 条保修记录</p>
        </div>
        <button onClick={() => setReloadKey((k) => k + 1)} className="btn-secondary">
          刷新
        </button>
      </header>

      <div className="flex items-center gap-2 mb-4 border-b border-slate-200">
        {(['all', 'active', 'pending', 'review', 'rejected', 'expired'] as StatusFilter[]).map(
          (k) => {
            const active = status === k;
            return (
              <button
                key={k}
                onClick={() => setStatus(k)}
                className={`px-4 py-2 text-sm border-b-2 -mb-px transition ${
                  active
                    ? 'border-matoo text-matoo-dark font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {STATUS_LABEL[k]}
              </button>
            );
          },
        )}
      </div>

      {error !== null && !items && <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />}
      {!items && !error && <PageLoading />}
      {items && items.length === 0 && <EmptyState title="暂无保修记录" />}

      {selected.size > 0 && (
        <div className="card p-4 mb-4 bg-matoo-light/30 dark:bg-matoo/10 border-matoo/30 flex flex-wrap items-center gap-3">
          <div className="text-sm font-medium">
            已选 <span className="text-matoo-dark dark:text-matoo-light">{selected.size}</span> 条
          </div>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as WarrantyReviewStatus)}
            className="input max-w-[120px]"
          >
            <option value="active">激活</option>
            <option value="pending">待审</option>
            <option value="rejected">驳回</option>
            <option value="expired">过期</option>
          </select>
          <input
            value={bulkNotes}
            onChange={(e) => setBulkNotes(e.target.value)}
            placeholder="可选:审批备注"
            className="input max-w-xs"
          />
          <button
            type="button"
            onClick={handleBulk}
            disabled={bulking}
            className="btn-primary"
          >
            {bulking ? '提交中...' : '批量提交'}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="btn-ghost"
          >
            清除选择
          </button>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="table-th w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="accent-matoo"
                  />
                </th>
                <th className="table-th">保修 ID</th>
                <th className="table-th">SKU</th>
                <th className="table-th">用户</th>
                <th className="table-th">状态</th>
                <th className="table-th">激活时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr
                  key={w.id}
                  className={`hover:bg-slate-50/60 cursor-pointer ${
                    selected.has(w.id) ? 'bg-matoo-light/30 dark:bg-matoo/10' : ''
                  }`}
                  onClick={() => setOpenId(w.id)}
                >
                  <td className="table-td" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(w.id)}
                      onChange={() => toggleOne(w.id)}
                      className="accent-matoo"
                    />
                  </td>
                  <td className="table-td font-mono text-xs">{w.id}</td>
                  <td className="table-td font-mono text-xs">{w.skuId}</td>
                  <td className="table-td">
                    <div>{w.userDisplayName ?? w.userPhone ?? w.userId}</div>
                    {w.userPhone && (
                      <div className="text-[11px] text-slate-500 font-mono">{w.userPhone}</div>
                    )}
                  </td>
                  <td className="table-td">
                    <span className={`chip ${STATUS_CHIP[w.status] ?? 'chip-gray'}`}>
                      {STATUS_LABEL[w.status as StatusFilter] ?? w.status}
                    </span>
                  </td>
                  <td className="table-td text-xs text-slate-500">
                    {w.activatedAt
                      ? new Date(w.activatedAt).toLocaleString('zh-CN')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <WarrantyDetailDrawer
        warrantyId={openId}
        open={!!openId}
        onClose={() => setOpenId(null)}
        onChanged={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}
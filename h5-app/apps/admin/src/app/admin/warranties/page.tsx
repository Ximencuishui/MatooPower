// Admin 保修管理 — 桌面端表格 + 批量审批 + 单条详情 Drawer
'use client';

import { useEffect, useState } from 'react';
import {
  listWarranties,
  bulkReviewWarranties,
  listDealers,
  type AdminWarrantyItem,
  type WarrantyReviewStatus,
  type BulkReviewItemBody,
  type DealerItem,
} from '@/lib/api/operations';
import { useRequireRole, RoleGuardView } from '@/lib/useRequireRole';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { WarrantyDetailDrawer } from '@/components/drawers/WarrantyDetailDrawer';

/**
 * #P0-1:UI 状态筛只取 DB 真实枚举;'复审' 不作为后端字段,改为
 *  '待审 · 有备注' 的混合标记(下面 'pendingWithNotes' 复用 pending 状态但 page 内加锁筛选)
 */
type StatusFilter = 'all' | 'active' | 'pending' | 'rejected' | 'expired';
type ReviewTagFilter = 'all' | 'needsReview';
const STATUS_LABEL: Record<StatusFilter, string> = {
  all: '全部',
  active: '激活',
  pending: '待审',
  rejected: '驳回',
  expired: '过期',
};
const STATUS_CHIP: Record<string, string> = {
  active: 'chip-green',
  pending: 'chip-orange',
  rejected: 'chip-red',
  expired: 'chip-gray',
};

export default function AdminWarrantiesPage() {
  const guard = useRequireRole(['admin']);
  const [status, setStatus] = useState<StatusFilter>('all');
  /** #P0-1:辅助过滤 — pending 且有 reviewNotes 的质保以紫色 chip 标记 */
  const [reviewTag, setReviewTag] = useState<ReviewTagFilter>('all');
  /** #P1-5:经销商过滤(下拉来源:GET /admin/dealers 仅取 active 列表) */
  const [dealerId, setDealerId] = useState<string>('');
  const [dealers, setDealers] = useState<DealerItem[]>([]);
  const [items, setItems] = useState<AdminWarrantyItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<WarrantyReviewStatus>('active');
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulking, setBulking] = useState(false);
  /** #P1-4:逐行覆盖 notes */
  const [perRowNotes, setPerRowNotes] = useState<Record<string, string>>({});

  // 经销商下拉数据(进入页面即拉一次)
  useEffect(() => {
    if (guard.status !== 'ok') return;
    const ac = new AbortController();
    listDealers({ status: 'active', pageSize: 200 }, ac.signal)
      .then((r) => setDealers(r.items))
      .catch(() => undefined);
    return () => ac.abort();
  }, [guard.status]);

  useEffect(() => {
    if (guard.status !== 'ok') return;
    const ac = new AbortController();
    setError(null);
    listWarranties(
      {
        status: status === 'all' ? undefined : status,
        dealerId: dealerId || undefined,
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
  }, [status, dealerId, guard.status, reloadKey]);

  /** #P0-1:'需复审' 是前端派生态:status=pending 且有 reviewNotes */
  const filteredItems = items
    ? reviewTag === 'needsReview'
      ? items.filter((w) => w.status === 'pending' && (w as { reviewNotes?: string | null }).reviewNotes)
      : items
    : null;

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title="保修管理" />;
  }

  const allSelected = !!filteredItems && filteredItems.length > 0 && filteredItems.every((w) => selected.has(w.id));
  function toggleAll() {
    if (!filteredItems) return;
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filteredItems.map((w) => w.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * #P1-4:统一触发批量审核,UI 上提供「共享 notes」+「逐条 notes」两种入口
   * - 若某行有 perRowNotes 填写 → 走逐条模式 (items[])
   * - 否则走统一模式 (ids[] + 顶层 status/notes)
   */
  async function handleBulk() {
    if (selected.size === 0 || bulking) return;
    setBulking(true);
    try {
      const ids = Array.from(selected);
      const hasPerRow = ids.some((id) => (perRowNotes[id] ?? '').trim().length > 0);
      const res = hasPerRow
        ? await bulkReviewWarranties({
            items: ids.map<BulkReviewItemBody>((id) => ({
              id,
              status: bulkStatus,
              notes: perRowNotes[id]?.trim() || undefined,
            })),
            status: bulkStatus,
            notes: bulkNotes.trim() || undefined,
          })
        : await bulkReviewWarranties({
            ids,
            status: bulkStatus,
            notes: bulkNotes.trim() || undefined,
          });
      alert(`批量审批完成：成功 ${res.succeeded.length} 条，失败 ${res.failed.length} 条`);
      setSelected(new Set());
      setBulkNotes('');
      setPerRowNotes({});
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

      <div className="flex flex-wrap items-center gap-2 mb-4 border-b border-slate-200">
        {(['all', 'active', 'pending', 'rejected', 'expired'] as StatusFilter[]).map(
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
        {/* #P0-1:独立 chip 切到「需复审」(派生过滤),不再依赖 DB 不存在的 'review' 枚举 */}
        <button
          onClick={() => setReviewTag(reviewTag === 'needsReview' ? 'all' : 'needsReview')}
          className={`ml-3 px-3 py-1.5 text-xs rounded-full border ${
            reviewTag === 'needsReview'
              ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-200'
              : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
          }`}
          title="待审且有审批备注 — 派生态，不占用独立状态位"
        >
          ⚑ 需复审
        </button>

        {/* #P1-5:经销商过滤(放在 Tab 行右侧)— 选中后只显示该经销商的保修 */}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-slate-500">经销商</label>
          <select
            value={dealerId}
            onChange={(e) => setDealerId(e.target.value)}
            className="input max-w-[200px] py-1.5 text-xs"
          >
            <option value="">全部经销商</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>{d.companyName}</option>
            ))}
          </select>
          {dealerId && (
            <button
              onClick={() => setDealerId('')}
              className="text-xs text-matoo hover:underline"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {error !== null && !filteredItems && <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />}
      {!filteredItems && !error && <PageLoading />}
      {filteredItems && filteredItems.length === 0 && <EmptyState title="暂无保修记录" />}

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

      {filteredItems && filteredItems.length > 0 && (
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
                {/* #P1-5:经销商列(若列表命中经销商过滤,展示 dealerCompanyName) */}
                <th className="table-th">经销商</th>
                <th className="table-th">状态</th>
                <th className="table-th">激活时间</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((w) => (
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
                    {w.dealerCompanyName ? (
                      <span className="chip chip-violet">{w.dealerCompanyName}</span>
                    ) : (
                      <span className="text-[11px] text-slate-400">直销</span>
                    )}
                  </td>
                  <td className="table-td">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`chip ${STATUS_CHIP[w.status] ?? 'chip-gray'}`}>
                        {STATUS_LABEL[w.status as StatusFilter] ?? w.status}
                      </span>
                      {/* #P0-1:派生复审提示 */}
                      {w.status === 'pending' && (w as { reviewNotes?: string | null }).reviewNotes && (
                        <span className="chip chip-purple text-[10px]" title="已有审批备注">⚑ 复审</span>
                      )}
                    </div>
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
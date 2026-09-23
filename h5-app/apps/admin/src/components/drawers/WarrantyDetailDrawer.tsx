// Admin 保修详情 Drawer
// - 保修元信息 + 状态变更（POST /admin/warranties/:id/review）
// - 审计轨迹（status → status + 操作员 + 时间 + 备注）
'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '@/components/Drawer';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';
import {
  getWarrantyDetail,
  reviewWarranty,
  type WarrantyDetail,
  type WarrantyReviewStatus,
} from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';

type Status = WarrantyReviewStatus;
const STATUS_LABEL: Record<Status, string> = {
  active: '已激活',
  pending: '待审核',
  expired: '已过期',
  rejected: '已拒绝',
  review: '复核中',
};
const STATUS_COLOR: Record<Status, string> = {
  active: 'chip-emerald',
  pending: 'chip-amber',
  expired: 'chip-slate',
  rejected: 'chip-rose',
  review: 'chip-violet',
};

interface Props {
  warrantyId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export function WarrantyDetailDrawer({ warrantyId, open, onClose, onChanged }: Props) {
  const [warranty, setWarranty] = useState<WarrantyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !warrantyId) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setNotes('');
    getWarrantyDetail(warrantyId, ctrl.signal)
      .then((r) => setWarranty(r.warranty))
      .catch((e) => setError(e as Error))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [open, warrantyId]);

  async function handleReview(next: Status) {
    if (!warranty || saving || warranty.status === next) return;
    setSaving(true);
    try {
      await reviewWarranty(warranty.id, next, notes.trim() || undefined);
      const fresh = await getWarrantyDetail(warranty.id);
      setWarranty(fresh.warranty);
      setNotes('');
      onChanged?.();
    } catch (e) {
      alert('审批失败: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="保修详情"
      subtitle={warranty?.s_modelName ?? warranty?.s_sku ?? warrantyId ?? ''}
      width="lg"
    >
      {loading && <PageLoading />}
      {error && <ErrorBlock error={error} />}
      {warranty && !loading && !error && (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500 mb-1">SKU</div>
              <div className="font-mono">{warranty.s_sku ?? warranty.skuId}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">型号</div>
              <div className="font-medium">{warranty.s_modelName ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">序列号</div>
              <div className="font-mono">{warranty.s_serial ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">国家</div>
              <div>{warranty.country ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">激活时间</div>
              <div className="font-mono text-xs">{warranty.createdAt}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">当前状态</div>
              <span className={`chip ${STATUS_COLOR[warranty.status]}`}>
                {STATUS_LABEL[warranty.status]}
              </span>
            </div>
            {warranty.invoiceNo && (
              <div>
                <div className="text-xs text-slate-500 mb-1">发票号</div>
                <div className="font-mono">{warranty.invoiceNo}</div>
              </div>
            )}
            {warranty.deviceId && (
              <div>
                <div className="text-xs text-slate-500 mb-1">设备 ID</div>
                <div className="font-mono text-xs truncate">{warranty.deviceId}</div>
              </div>
            )}
            {warranty.notes && (
              <div className="col-span-2">
                <div className="text-xs text-slate-500 mb-1">用户备注</div>
                <div className="card p-3 text-sm whitespace-pre-wrap">
                  {warranty.notes}
                </div>
              </div>
            )}
            {warranty.reviewNotes && (
              <div className="col-span-2">
                <div className="text-xs text-slate-500 mb-1">审批备注</div>
                <div className="card p-3 text-sm whitespace-pre-wrap bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                  {warranty.reviewNotes}
                </div>
              </div>
            )}
          </section>

          <section>
            <div className="text-xs text-slate-500 mb-2">变更状态 + 备注</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="可选:填写审批意见"
              rows={2}
              className="input w-full resize-y mb-2"
            />
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleReview(s)}
                  disabled={saving || warranty.status === s}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                    warranty.status === s
                      ? 'bg-matoo-light dark:bg-matoo/20 border-matoo text-matoo-dark dark:text-matoo-light font-semibold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  } disabled:opacity-50`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </section>

          {warranty.auditLogs && warranty.auditLogs.length > 0 && (
            <section>
              <div className="text-xs text-slate-500 mb-2">
                审计轨迹 · {warranty.auditLogs.length} 条
              </div>
              <div className="space-y-2">
                {warranty.auditLogs.map((log, idx) => (
                  <div key={idx} className="card p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{log.action}</span>
                      <span className="text-[11px] font-mono text-slate-500">{log.at}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mb-1">by {log.by}</div>
                    {log.notes && (
                      <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {log.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}
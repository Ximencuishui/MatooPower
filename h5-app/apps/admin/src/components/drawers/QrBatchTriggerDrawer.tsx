// Admin QR 批次触发 Drawer（POST /admin/qr-batch）
'use client';

import { useState } from 'react';
import { Drawer } from '@/components/Drawer';
import { triggerQrBatch } from '@/lib/api/operations';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultBatchId?: string;
  onDone?: () => void;
}

export function QrBatchTriggerDrawer({ open, onClose, defaultBatchId = '', onDone }: Props) {
  const [batchId, setBatchId] = useState(defaultBatchId);
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!batchId.trim()) {
      alert('批次 ID 必填');
      return;
    }
    setSubmitting(true);
    try {
      const body: { batchId: string; quantity?: number } = { batchId: batchId.trim() };
      if (quantity) body.quantity = Number(quantity);
      const r = await triggerQrBatch(body);
      alert(`QR 批次任务已创建: ${r.task.id}（状态 ${r.task.status}）`);
      onDone?.();
      onClose();
      setQuantity('');
    } catch (err) {
      alert('触发失败: ' + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="生成 QR 批次" width="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-slate-500">
            批次 ID *
          </label>
          <input
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            required
            placeholder="sb-xxx (SkuBatch ID)"
            className="input mt-1"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-slate-500">
            生成数量（可选, 留空=该批次全部）
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="100"
            className="input mt-1"
          />
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
          <button type="button" onClick={onClose} className="btn-ghost">
            取消
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? '触发中…' : '触发'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
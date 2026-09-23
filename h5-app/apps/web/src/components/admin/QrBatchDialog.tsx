'use client';
// v1.3 P0:QR 批量生成 Drawer（数量 / 尺寸选择 + 触发后展示状态）

import { useEffect, useState } from 'react';
import { triggerAdminQrBatch, getAdminQrBatch, type QrBatchItem, type SkuBatchItem } from '@/lib/api/operations';
import { saveBlob } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';

interface QrBatchDialogProps {
  open: boolean;
  onClose: () => void;
  onDone: (task: QrBatchItem) => void;
  batches: SkuBatchItem[];
}

export function QrBatchDialog({ open, onClose, onDone, batches }: QrBatchDialogProps) {
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [task, setTask] = useState<QrBatchItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null); setTask(null);
      setBatchId(batches[0]?.id ?? '');
      setQuantity('');
    }
  }, [open, batches]);

  // 轮询任务状态（如果 running）
  useEffect(() => {
    if (!task || task.status !== 'running') return;
    const t = setInterval(async () => {
      try {
        const r = await getAdminQrBatch(task.id);
        setTask(r.task);
        if (r.task.status !== 'running') { clearInterval(t); onDone(r.task); }
      } catch { /* ignore */ }
    }, 1500);
    return () => clearInterval(t);
  }, [task, onDone]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!batchId) { setError('请选择批次'); return; }
    const q = quantity ? Number(quantity) : undefined;
    if (q !== undefined && (q < 1 || q > 5000)) { setError('数量必须在 1-5000'); return; }
    setSubmitting(true);
    try {
      const r = await triggerAdminQrBatch({ batchId, quantity: q });
      setTask(r.task);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!task) return;
    try {
      const blob = await (await import('@/lib/api/operations')).downloadAdminQrBatch(task.id);
      saveBlob(blob, `qr-batch-${task.id}.zip`);
    } catch (e) {
      setError('下载失败：' + (e as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg p-5 space-y-3 shadow-xl">
        <h2 className="text-lg font-semibold">批量生成 QR</h2>
        {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        {!task ? (
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-xs text-slate-600">选择批次 *</span>
              <select value={batchId} onChange={(e) => setBatchId(e.target.value)} required
                className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white">
                <option value="">请选择...</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.batchCode} ({b.skuCount} SKU)</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-600">数量（1-5000，留空按 SKU 数）</span>
              <input type="number" min={1} max={5000} value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="例如：500"
                className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
            </label>
            <p className="text-xs text-slate-500">
              将签发 HMAC 签名 + 生成 PNG + 打包 ZIP（含 manifest.csv）。每个 PNG 默认 512×512px。
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded">取消</button>
              <button type="submit" disabled={submitting || !batchId}
                className="px-4 py-2 text-sm bg-matoo text-white rounded disabled:opacity-50">
                {submitting ? '生成中…' : '开始生成'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="text-sm">
              任务 ID：<code className="text-xs bg-slate-100 px-1 rounded">{task.id}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${
                task.status === 'done' ? 'bg-green-500' :
                task.status === 'failed' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'
              }`} aria-hidden="true" />
              <span className="text-sm font-medium">{
                task.status === 'pending' ? '排队中' :
                task.status === 'running' ? '生成中…' :
                task.status === 'done' ? '完成' : '失败'
              }</span>
              {task.status === 'done' && (
                <span className="text-xs text-slate-500">已生成 {task.generatedCount} 个 PNG</span>
              )}
            </div>
            {task.errorMessage && (
              <div className="text-xs text-red-600">{task.errorMessage}</div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              {task.status === 'done' && (
                <button type="button" onClick={handleDownload}
                  className="px-4 py-2 text-sm bg-matoo text-white rounded">下载 ZIP</button>
              )}
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded">关闭</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
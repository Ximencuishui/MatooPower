'use client';
// v1.3 P0:SKU 批次创建/编辑 Drawer

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { createAdminSkuBatch, updateAdminSkuBatch, type SkuBatchItem } from '@/lib/api/operations';

interface SkuBatchFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (b: SkuBatchItem) => void;
  /** 编辑模式传入,新建模式不传 */
  editing?: SkuBatchItem;
}

export function SkuBatchForm({ open, onClose, onSaved, editing }: SkuBatchFormProps) {
  const { t } = useT();
  const [batchCode, setBatchCode] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [factory, setFactory] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (editing) {
        setBatchCode(editing.batchCode);
        setMfgDate(editing.mfgDate.slice(0, 10));
        setFactory(editing.factory ?? '');
        setDestinationCountry(editing.destinationCountry ?? '');
        setTotalQuantity(editing.totalQuantity ? String(editing.totalQuantity) : '');
        setNote(editing.note ?? '');
      } else {
        setBatchCode(''); setMfgDate(''); setFactory('');
        setDestinationCountry(''); setTotalQuantity(''); setNote('');
      }
    }
  }, [open, editing]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^BATCH-\d{4}Q[1-4]-\d{3,6}$/.test(batchCode)) {
      setError('批次号格式：BATCH-2026Q3-001'); return;
    }
    if (!mfgDate) { setError('生产日期必填'); return; }
    setSubmitting(true);
    try {
      const body = {
        batchCode,
        mfgDate: new Date(mfgDate).toISOString(),
        factory: factory || undefined,
        destinationCountry: destinationCountry || undefined,
        totalQuantity: totalQuantity ? Number(totalQuantity) : undefined,
        note: note || undefined,
      };
      const r = editing
        ? await updateAdminSkuBatch(editing.id, body)
        : await createAdminSkuBatch(body);
      onSaved(r.batch);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg p-5 space-y-3 shadow-xl">
        <h2 className="text-lg font-semibold">
          {editing ? '编辑批次' : '新建批次'}
        </h2>
        {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        <label className="block">
          <span className="text-xs text-slate-600">批次号 *</span>
          <input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} required
            placeholder="BATCH-2026Q3-001"
            className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs text-slate-600">生产日期 *</span>
          <input type="date" value={mfgDate} onChange={(e) => setMfgDate(e.target.value)} required
            className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-slate-600">工厂</span>
            <input value={factory} onChange={(e) => setFactory(e.target.value)}
              placeholder="Matoo Plant A"
              className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">目的国（ISO 2 位）</span>
            <input value={destinationCountry} onChange={(e) => setDestinationCountry(e.target.value.toUpperCase())}
              maxLength={2} placeholder="BD / IN"
              className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm uppercase" />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-slate-600">计划生产数</span>
          <input type="number" min={1} value={totalQuantity} onChange={(e) => setTotalQuantity(e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs text-slate-600">备注</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded">取消</button>
          <button type="submit" disabled={submitting}
            className="px-4 py-2 text-sm bg-matoo text-white rounded disabled:opacity-50">
            {submitting ? '保存中…' : (editing ? '保存' : '创建')}
          </button>
        </div>
      </form>
    </div>
  );
}
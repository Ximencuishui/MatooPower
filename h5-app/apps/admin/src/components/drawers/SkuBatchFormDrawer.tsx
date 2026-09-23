// Admin SKU 批次表单 Drawer（新建 / 编辑 复用）
'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '@/components/Drawer';
import type { SkuBatchWithStats } from '@/lib/api/operations';

interface Props {
  open: boolean;
  onClose: () => void;
  initial: SkuBatchWithStats | null;
  onSubmit: (body: {
    batchCode: string;
    mfgDate: string;
    factory?: string;
    destinationCountry?: string;
    totalQuantity: number;
    note?: string;
  }) => Promise<void>;
}

/** 与后端 dto 保持一致: ^BATCH-\d{4}Q[1-4]-\d{3,6}$ */
const BATCH_CODE_RE = /^BATCH-\d{4}Q[1-4]-\d{3,6}$/;

export function SkuBatchFormDrawer({ open, onClose, initial, onSubmit }: Props) {
  const [batchCode, setBatchCode] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [factory, setFactory] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBatchCode(initial?.batchCode ?? '');
    setMfgDate(initial?.mfgDate ? initial.mfgDate.slice(0, 10) : '');
    setFactory(initial?.factory ?? '');
    setDestinationCountry(initial?.destinationCountry ?? '');
    setTotalQuantity(initial ? String(initial.totalQuantity) : '');
    setNote(initial?.note ?? '');
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!batchCode.trim() || !mfgDate || !totalQuantity) {
      alert('批次号 / 生产日期 / 总数量 必填');
      return;
    }
    if (!initial && !BATCH_CODE_RE.test(batchCode.trim())) {
      alert('批次号格式：BATCH-2026Q3-001（季度+3-6 位序号）');
      return;
    }
    if (destinationCountry.trim() && !/^[A-Z]{2}$/.test(destinationCountry.trim().toUpperCase())) {
      alert('目的地必须是 ISO 3166-1 两位大写字母（如 BD / CN / US）');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        batchCode: batchCode.trim(),
        mfgDate,
        factory: factory.trim() || undefined,
        destinationCountry: destinationCountry.trim().toUpperCase() || undefined,
        totalQuantity: Number(totalQuantity),
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err) {
      alert('保存失败: ' + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={initial ? '编辑批次' : '新建批次'}
      width="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="批次号 *"
          value={batchCode}
          onChange={setBatchCode}
          required
          placeholder="BATCH-2026Q3-001"
          pattern="BATCH-\d{4}Q[1-4]-\d{3,6}"
          disabled={!!initial}
          hint={initial ? '批次号不可修改' : '格式：BATCH-YYYYQn-NNN（季度 + 3-6 位序号）'}
        />
        <Field
          label="生产日期 *"
          value={mfgDate}
          onChange={setMfgDate}
          type="date"
          required
        />
        <Field label="工厂" value={factory} onChange={setFactory} placeholder="Shenzhen Plant A" />
        <Field
          label="目的地国家"
          value={destinationCountry}
          onChange={setDestinationCountry}
          placeholder="BD / US / IN（ISO 3166-1 两位）"
          maxLength={2}
        />
        <Field
          label="总数量 *"
          value={totalQuantity}
          onChange={setTotalQuantity}
          type="number"
          required
        />
        <div>
          <label className="text-[11px] uppercase tracking-wide text-slate-500">备注</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input mt-1 min-h-[80px]"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
          <button type="button" onClick={onClose} className="btn-ghost">
            取消
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
  pattern,
  disabled = false,
  maxLength,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  pattern?: string;
  disabled?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wide text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        pattern={pattern}
        disabled={disabled}
        maxLength={maxLength}
        className="input mt-1 disabled:bg-slate-100 disabled:cursor-not-allowed"
      />
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
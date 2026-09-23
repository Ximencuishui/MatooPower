// Admin 经销商表单 Drawer（新建 / 编辑 复用）
// 提交由 props.onSubmit 提供，父组件决定 createDealer / updateDealer
'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '@/components/Drawer';
import type { DealerItem, DealerTier } from '@/lib/api/operations';

interface Props {
  open: boolean;
  onClose: () => void;
  initial: DealerItem | null; // null 表示新建
  onSubmit: (body: {
    companyName: string;
    country: string;
    tier: DealerTier;
    contactEmail?: string;
    contactPhone?: string;
    note?: string;
  }) => Promise<void>;
}

export function DealerFormDrawer({ open, onClose, initial, onSubmit }: Props) {
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('');
  const [tier, setTier] = useState<DealerTier>('silver');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCompanyName(initial?.companyName ?? '');
    setCountry(initial?.country ?? '');
    setTier(initial?.tier ?? 'silver');
    setContactEmail(initial?.contactEmail ?? '');
    setContactPhone(initial?.contactPhone ?? '');
    setNote(initial?.note ?? '');
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || !country.trim()) {
      alert('公司名与国家必填');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        companyName: companyName.trim(),
        country: country.trim().toUpperCase(),
        tier,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
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
      title={initial ? `编辑经销商` : '新建经销商'}
      width="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="公司名 *" value={companyName} onChange={setCompanyName} required />
        <Field
          label="国家 (ISO 3166-1) *"
          value={country}
          onChange={setCountry}
          required
          placeholder="BD / IN / CN"
        />
        <div>
          <label className="text-[11px] uppercase tracking-wide text-slate-500">等级</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as DealerTier)}
            className="input mt-1"
          >
            <option value="silver">白银</option>
            <option value="gold">黄金</option>
            <option value="platinum">铂金</option>
          </select>
        </div>
        <Field
          label="联系邮箱"
          value={contactEmail}
          onChange={setContactEmail}
          type="email"
          placeholder="contact@example.com"
        />
        <Field
          label="联系电话"
          value={contactPhone}
          onChange={setContactPhone}
          placeholder="+880..."
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
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
        className="input mt-1"
      />
    </div>
  );
}
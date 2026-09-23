// Admin SKU 文档上传 Drawer（multipart/form-data → /admin/sku-document）
'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '@/components/Drawer';
import { uploadSkuDocument, DOC_TYPES, DOC_LANGS, type DocType, type DocLang } from '@/lib/api/operations';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultSkuId?: string;
  defaultBatchId?: string;
  onDone?: () => void;
}

/** 与后端 upload.dto.ts TYPE_RULES 保持一致 */
const TYPE_ACCEPT: Record<DocType, { accept: string; label: string }> = {
  manual: { accept: 'application/pdf', label: 'PDF 文档' },
  video: { accept: 'video/mp4,video/webm,video/quicktime', label: '视频文件 (mp4 / webm / mov)' },
  specsheet: { accept: 'application/pdf', label: 'PDF 数据手册' },
  faq: { accept: 'application/pdf,text/plain', label: 'FAQ (PDF / TXT)' },
};

export function SkuDocumentUploadDrawer({
  open,
  onClose,
  defaultSkuId = '',
  defaultBatchId = '',
  onDone,
}: Props) {
  const [skuId, setSkuId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [type, setType] = useState<DocType>('manual');
  const [lang, setLang] = useState<DocLang>('en');
  const [version, setVersion] = useState('v1');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 打开时同步默认值（仅在 open 切换瞬间）
  useEffect(() => {
    if (open) {
      if (defaultSkuId) setSkuId(defaultSkuId);
      if (defaultBatchId) setBatchId(defaultBatchId);
    }
  }, [open, defaultSkuId, defaultBatchId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !skuId.trim() || !title.trim()) {
      alert('文件 / SKU ID / 标题 必填');
      return;
    }
    // MIME 与所选类型对齐（后端会再做严格校验，这里提前拦下明显错误）
    const allowed = TYPE_ACCEPT[type].accept.split(',').map((s) => s.trim());
    if (!allowed.includes(file.type)) {
      alert(`${TYPE_ACCEPT[type].label} 期望 MIME：${TYPE_ACCEPT[type].accept}\n当前文件类型：${file.type || '未知'}`);
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('skuId', skuId.trim());
      fd.append('batchId', batchId.trim());
      fd.append('type', type);
      fd.append('lang', lang);
      fd.append('version', version);
      fd.append('title', title.trim());
      await uploadSkuDocument(fd);
      onDone?.();
      onClose();
      // reset
      setFile(null);
      setTitle('');
      setVersion('v1');
    } catch (err) {
      alert('上传失败: ' + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="上传文档" width="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="SKU ID *"
          value={skuId}
          onChange={setSkuId}
          required
          placeholder="MATO-MAT12200-DEMO0002"
        />
        <Field label="批次 ID (可选)" value={batchId} onChange={setBatchId} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-slate-500">类型 *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DocType)}
              className="input mt-1"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-slate-500">语言 *</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as DocLang)}
              className="input mt-1"
            >
              {DOC_LANGS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Field
          label="版本 *"
          value={version}
          onChange={setVersion}
          required
          placeholder="v1 / v1.0 / v2.3"
        />

        <Field label="标题 *" value={title} onChange={setTitle} required />

        <div>
          <label className="text-[11px] uppercase tracking-wide text-slate-500">
            文件 * {TYPE_ACCEPT[type].label}，最大 200MB
          </label>
          <input
            type="file"
            accept={TYPE_ACCEPT[type].accept}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-matoo-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-matoo-dark hover:file:bg-matoo/20"
          />
          {file && (
            <div className="text-xs text-slate-500 mt-1">
              {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || '未知 MIME'}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
          <button type="button" onClick={onClose} className="btn-ghost">
            取消
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? '上传中…' : '上传'}
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
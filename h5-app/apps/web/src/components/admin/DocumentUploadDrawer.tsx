'use client';
// v1.3 P0:文档上传 Drawer（SKU + type + lang + version + file + title）

import { useEffect, useState } from 'react';
import { uploadAdminSkuDocument, type SkuDocumentItem } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { LangChips, DocTypeChips } from './LangChips';

interface DocumentUploadDrawerProps {
  open: boolean;
  onClose: () => void;
  onUploaded: (doc: SkuDocumentItem) => void;
  skus: Array<{ id: string; sku: string; modelName: string }>;
  /** 预选 SKU（从 SKU 列表行点击进入） */
  preselectedSkuId?: string;
}

export function DocumentUploadDrawer({ open, onClose, onUploaded, skus, preselectedSkuId }: DocumentUploadDrawerProps) {
  const [skuId, setSkuId] = useState('');
  const [type, setType] = useState('manual');
  const [lang, setLang] = useState('en');
  const [version, setVersion] = useState('v1.0');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setSkuId(preselectedSkuId ?? '');
      setType('manual'); setLang('en'); setVersion('v1.0'); setTitle(''); setFile(null);
    }
  }, [open, preselectedSkuId]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!skuId) { setError('请选择 SKU'); return; }
    if (!file) { setError('请选择文件'); return; }
    if (!title) { setError('请填写标题'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('skuId', skuId);
      fd.append('type', type);
      fd.append('lang', lang);
      fd.append('version', version);
      fd.append('title', title);
      const r = await uploadAdminSkuDocument(fd);
      onUploaded(r.document);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg p-5 space-y-3 shadow-xl max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-semibold">上传文档</h2>
        {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        <label className="block">
          <span className="text-xs text-slate-600">SKU *</span>
          <select value={skuId} onChange={(e) => setSkuId(e.target.value)} required
            className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white">
            <option value="">请选择...</option>
            {skus.map((s) => (
              <option key={s.id} value={s.id}>{s.sku} - {s.modelName}</option>
            ))}
          </select>
        </label>
        <div>
          <span className="text-xs text-slate-600 block mb-1">文档类型</span>
          <DocTypeChips selected={type} onChange={setType} />
        </div>
        <div>
          <span className="text-xs text-slate-600 block mb-1">语言</span>
          <LangChips selected={lang} onChange={setLang} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-slate-600">版本号 *</span>
            <input value={version} onChange={(e) => setVersion(e.target.value)} required
              placeholder="v1.0"
              className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm font-mono" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">标题 *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required
              placeholder="MAT12200 用户手册（英文）v1.0"
              className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-slate-600">文件 *（PDF ≤30MB / 视频 ≤200MB / FAQ ≤10MB）</span>
          <input type="file" required accept=".pdf,.mp4,.webm,.mov,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-matoo file:text-white file:cursor-pointer" />
          {file && (
            <div className="mt-1 text-xs text-slate-500">
              {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || 'unknown'}
            </div>
          )}
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded">取消</button>
          <button type="submit" disabled={submitting}
            className="px-4 py-2 text-sm bg-matoo text-white rounded disabled:opacity-50">
            {submitting ? '上传中…' : '上传'}
          </button>
        </div>
      </form>
    </div>
  );
}
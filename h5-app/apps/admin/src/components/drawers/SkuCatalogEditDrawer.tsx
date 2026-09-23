// Admin SKU 商品库编辑 Drawer（三 Tab：基本资料 / 详情图片 / 指导价）
// - Tab 1: description / videoTrailerUrl
// - Tab 2: SkuImage 列表 + 上传 + alt/caption/sortOrder/isCover 编辑 + 下架
// - Tab 3: guidePriceCents / guidePriceCurrency / guidePriceNote
// 风格参考 DealerDetailDrawer / SkuBatchFormDrawer(同 Drawer 组件 + tailwind)
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Drawer } from '@/components/Drawer';
import {
  type AdminSkuItem,
  type SkuCatalogView,
  type SkuImageRow,
  type SkuImageLang,
  SKU_IMAGE_LANGS,
  getSkuCatalog,
  updateSkuCatalog,
  listSkuImages,
  uploadSkuImage,
  bulkUploadSkuImages,
  updateSkuImage,
  deprecateSkuImage,
} from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { useLocale } from '@/lib/useLocale';
import { getDict } from '@/lib/i18n';

const LANG_LABEL: Record<SkuImageLang, string> = {
  zh: '中文',
  en: 'English',
  bn: 'বাংলা',
  hi: 'हिन्दी',
  ur: 'اردو',
};

const CURRENCY_OPTIONS = ['BDT', 'USD', 'CNY', 'EUR', 'INR', 'PKR'] as const;

type Tab = 'basic' | 'images' | 'price';

interface Props {
  open: boolean;
  onClose: () => void;
  sku: AdminSkuItem | null;
  onSaved?: () => void;
}

export function SkuCatalogEditDrawer({ open, onClose, sku, onSaved }: Props) {
  const { locale } = useLocale();
  const dict = getDict(locale);
  const [tab, setTab] = useState<Tab>('basic');

  // 三 Tab 各自的表单状态(各自独立 useEffect 同步 server 状态)
  const [catalog, setCatalog] = useState<SkuCatalogView | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Tab1
  const [description, setDescription] = useState('');
  const [videoTrailerUrl, setVideoTrailerUrl] = useState('');
  const [descMode, setDescMode] = useState<'edit' | 'preview' | 'split'>('split');
  const descTaRef = useRef<HTMLTextAreaElement | null>(null);

  // Tab2
  const [imageLang, setImageLang] = useState<SkuImageLang>('en');
  const [images, setImages] = useState<SkuImageRow[]>([]);
  const [reordering, setReordering] = useState(false);
  // 拖拽状态：当前被拖项 id + 目标插入位置
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  // 批量上传队列：待上传/上传中/成功/失败，每项独立状态
  interface BulkTask {
    id: string;        // 本地唯一 id（不是后端 image id）
    file: File;
    name: string;
    sizeBytes: number;
    status: 'pending' | 'uploading' | 'done' | 'failed';
    progress: number;  // 0..100
    error?: string;
    imageId?: string;  // 成功后回填
  }
  const [bulkTasks, setBulkTasks] = useState<BulkTask[]>([]);
  const bulkInFlight = useRef<AbortController | null>(null);

  // Tab3
  const [priceCents, setPriceCents] = useState<string>('');
  const [currency, setCurrency] = useState<string>('BDT');
  const [priceNote, setPriceNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // 打开时拉取完整 catalog + 选中语言的图片
  useEffect(() => {
    if (!open || !sku) return;
    setLoadErr(null);
    setDirty(false);
    setTab('basic');
    // 清理旧会话残留状态(防止上次的 bulkTasks / drag 状态泄漏)
    setBulkTasks([]);
    setImages([]);
    setDragId(null);
    setDragOverIdx(null);
    bulkInFlight.current?.abort();
    bulkInFlight.current = null;
    const ac = new AbortController();
    getSkuCatalog(sku.id, ac.signal)
      .then((r) => {
        const cat = r.catalog;
        setCatalog(cat);
        setDescription(cat.description ?? '');
        setVideoTrailerUrl(cat.videoTrailerUrl ?? '');
        setPriceCents(cat.guidePriceCents != null ? String(cat.guidePriceCents) : '');
        setCurrency(cat.guidePriceCurrency ?? 'BDT');
        setPriceNote(cat.guidePriceNote ?? '');
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setLoadErr(e instanceof Error ? e.message : '加载失败');
      });
    return () => ac.abort();
  }, [open, sku]);

  // 切换图片语言时拉对应 SkuImage 列表
  useEffect(() => {
    if (!open || !sku || tab !== 'images') return;
    const ac = new AbortController();
    listSkuImages({ skuId: sku.id, lang: imageLang }, ac.signal)
      .then((r) => setImages(r.items))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        alert('加载图片失败: ' + (e as Error).message);
      });
    return () => ac.abort();
  }, [open, sku, tab, imageLang]);

  // 组件卸载时中止未完成的批量上传，避免 setState on unmounted
  useEffect(() => {
    return () => {
      bulkInFlight.current?.abort();
      bulkInFlight.current = null;
    };
  }, []);

  const closeWithConfirm = () => {
    if (dirty) {
      if (!confirm(dict.skuEdit.confirmClose)) return;
    }
    // 关闭时立即中止上传
    bulkInFlight.current?.abort();
    bulkInFlight.current = null;
    setBulkTasks([]);
    onClose();
  };

  // ---------- Tab1: 基本资料 ----------
  // 在当前光标位置插入 Markdown 模板（未选中时插入默认占位文本）
  function insertMarkdown(snippet: string, placeholder: string) {
    const ta = descTaRef.current;
    if (!ta) {
      setDescription((d) => d + snippet);
      setDirty(true);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = description.slice(start, end);
    const fill = selected || placeholder;
    const inserted = snippet.replace('{X}', fill);
    const before = description.slice(0, start);
    const after = description.slice(end);
    const next = before + inserted + after;
    setDescription(next);
    setDirty(true);
    const caret = start + inserted.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  }

  async function saveBasic() {
    if (!sku) return;
    setSaving(true);
    try {
      await updateSkuCatalog(sku.id, {
        description,
        videoTrailerUrl: videoTrailerUrl.trim() || '',
      });
      setDirty(false);
      onSaved?.();
      alert(dict.skuEdit.saveOk);
    } catch (e) {
      alert(dict.skuEdit.saveFail.replace('{msg}', msgOf(e)));
    } finally {
      setSaving(false);
    }
  }

  // ---------- Tab2: 详情图片 ----------
  // (单张上传入口已合并到 handleBulkPick：批量通道自动处理 ≤5 张)

  // ---------- Tab2: 批量上传（≤5） ----------
  // 文件选择器变化时：多选 → 走批量通道
  function handleBulkPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !sku) return;
    const picked = Array.from(files).slice(0, 5);
    // MIME + 大小前端预检
    const ok: File[] = [];
    const rejected: { name: string; error: string }[] = [];
    for (const f of picked) {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type)) {
        rejected.push({ name: f.name, error: '仅支持 JPG / PNG / WEBP / GIF' });
        continue;
      }
      if (f.size > 8 * 1024 * 1024) {
        rejected.push({ name: f.name, error: '文件超过 8MB' });
        continue;
      }
      ok.push(f);
    }
    if (rejected.length) {
      alert('已跳过不合规文件：\n' + rejected.map((r) => `· ${r.name}: ${r.error}`).join('\n'));
    }
    if (ok.length === 0) {
      e.target.value = '';
      return;
    }
    // 入队
    const tasks: BulkTask[] = ok.map((f, i) => ({
      id: `bt-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      file: f,
      name: f.name,
      sizeBytes: f.size,
      status: 'pending',
      progress: 0,
    }));
    setBulkTasks((prev) => [...prev, ...tasks]);
    e.target.value = '';
    void runBulkUpload(tasks);
  }

  // 并行批量上传（单请求：把多张文件合并成一次 XHR）
  async function runBulkUpload(initialTasks: BulkTask[]) {
    if (!sku || initialTasks.length === 0) return;
    const ac = new AbortController();
    bulkInFlight.current?.abort();
    bulkInFlight.current = ac;
    const taskIds = new Set(initialTasks.map((t) => t.id));
    // 标记 uploading
    setBulkTasks((prev) =>
      prev.map((t) => (taskIds.has(t.id) ? { ...t, status: 'uploading', progress: 0 } : t)),
    );
    const fd = new FormData();
    initialTasks.forEach((t) => fd.append('files', t.file, t.name));
    fd.append('skuId', sku.id);
    fd.append('lang', imageLang);
    try {
      const result = await bulkUploadSkuImages(
        fd,
        (loaded, total) => {
          const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
          setBulkTasks((prev) =>
            prev.map((t) => (taskIds.has(t.id) ? { ...t, progress: pct } : t)),
          );
        },
        ac.signal,
      );
      // 按 fileName 映射（避免部分失败时下标错位）
      const resultMap = new Map(result.results.map((r) => [r.fileName, r]));
      const successIds: string[] = [];
      setBulkTasks((prev) =>
        prev.map((t) => {
          if (!taskIds.has(t.id)) return t;
          const r = resultMap.get(t.name);
          if (!r) {
            // 服务端未返回该文件名（理论不应发生）：记为失败
            return { ...t, status: 'failed', progress: 100, error: '服务器未返回结果' };
          }
          if (r.ok) {
            successIds.push(r.image.id);
            return { ...t, status: 'done', progress: 100, imageId: r.image.id };
          }
          return { ...t, status: 'failed', progress: 100, error: r.error };
        }),
      );
      // 刷新已上传图片列表 + catalog 快照
      if (successIds.length > 0) {
        const r = await listSkuImages({ skuId: sku.id, lang: imageLang });
        setImages(r.items);
        await refreshCatalogSnapshot();
      }
    } catch (err) {
      const msg = msgOf(err);
      setBulkTasks((prev) =>
        prev.map((t) =>
          taskIds.has(t.id) ? { ...t, status: 'failed', progress: 100, error: msg } : t,
        ),
      );
    } finally {
      if (bulkInFlight.current === ac) bulkInFlight.current = null;
    }
  }

  // 单张重试：失败任务以单文件方式重传（防重复点击 + AbortSignal 透传）
  async function retryBulkTask(task: BulkTask) {
    if (!sku) return;
    // 防重复点击：若该任务已在 uploading 状态，丢弃
    let started = false;
    setBulkTasks((prev) =>
      prev.map((t) => {
        if (t.id !== task.id) return t;
        if (t.status === 'uploading') return t;
        started = true;
        return { ...t, status: 'uploading', progress: 0, error: undefined };
      }),
    );
    if (!started) return;
    const ac = new AbortController();
    try {
      const fd = new FormData();
      fd.append('file', task.file, task.name);
      fd.append('skuId', sku.id);
      fd.append('lang', imageLang);
      const r = await uploadSkuImage(fd, ac.signal);
      setBulkTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: 'done', progress: 100, imageId: r.image.id } : t,
        ),
      );
      const list = await listSkuImages({ skuId: sku.id, lang: imageLang });
      setImages(list.items);
      await refreshCatalogSnapshot();
    } catch (err) {
      const aborted = err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message));
      setBulkTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: aborted ? 'failed' : 'failed', error: aborted ? '已取消' : msgOf(err) }
            : t,
        ),
      );
    }
  }

  async function handleSetCover(img: SkuImageRow) {
    if (!sku) return;
    try {
      await updateSkuImage(img.id, { isCover: !img.isCover });
      const r = await listSkuImages({ skuId: sku.id, lang: imageLang });
      setImages(r.items);
      await refreshCatalogSnapshot();
    } catch (e) {
      alert('设为主图失败: ' + msgOf(e));
    }
  }

  async function handleDeprecate(img: SkuImageRow) {
    if (!sku) return;
    if (!confirm(`下架图片 ${img.storageKey}？`)) return;
    try {
      await deprecateSkuImage(img.id);
      const r = await listSkuImages({ skuId: sku.id, lang: imageLang });
      setImages(r.items);
      await refreshCatalogSnapshot();
    } catch (e) {
      alert('下架失败: ' + msgOf(e));
    }
  }

  // 重排后批量提交：重新计算 sortOrder（0,1,2...）并并行 PATCH
  async function commitReorder(next: SkuImageRow[]) {
    if (!sku) return;
    // 优化：只 PATCH 顺序实际变化的项
    const patches: { id: string; sortOrder: number }[] = [];
    next.forEach((img, idx) => {
      if (img.sortOrder !== idx) patches.push({ id: img.id, sortOrder: idx });
    });
    if (patches.length === 0) return;
    setReordering(true);
    try {
      await Promise.all(patches.map((p) => updateSkuImage(p.id, { sortOrder: p.sortOrder })));
      // 本地列表同步服务端返回的 sortOrder
      const r = await listSkuImages({ skuId: sku.id, lang: imageLang });
      setImages(r.items);
    } catch (e) {
      alert(dict.skuEdit.imageReorderFail.replace('{msg}', msgOf(e)));
      // 失败时重新拉取服务器状态回滚
      try {
        const r = await listSkuImages({ skuId: sku.id, lang: imageLang });
        setImages(r.items);
      } catch { /* 忽略 */ }
    } finally {
      setReordering(false);
    }
  }

  function moveBy(img: SkuImageRow, delta: number) {
    const i = images.findIndex((x) => x.id === img.id);
    if (i < 0) return;
    const j = i + delta;
    if (j < 0 || j >= images.length) return;
    const next = images.slice();
    const a = next[i];
    const b = next[j];
    if (!a || !b) return;
    next[i] = b;
    next[j] = a;
    setImages(next);
    void commitReorder(next);
  }

  function moveTo(img: SkuImageRow, targetIdx: number) {
    const i = images.findIndex((x) => x.id === img.id);
    if (i < 0) return;
    const j = Math.max(0, Math.min(images.length - 1, targetIdx));
    if (i === j) return;
    const next = images.slice();
    const [moved] = next.splice(i, 1);
    if (!moved) return;
    next.splice(j, 0, moved);
    setImages(next);
    void commitReorder(next);
  }

  // ---- HTML5 拖拽 ----
  function onDragStart(e: React.DragEvent<HTMLDivElement>, id: string) {
    setDragId(id);
    setDragOverIdx(null);
    e.dataTransfer.effectAllowed = 'move';
    // 必须设置 data 才能在 Firefox 触发拖拽
    e.dataTransfer.setData('text/plain', id);
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== idx) setDragOverIdx(idx);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>, targetIdx: number) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    if (!id) return;
    const img = images.find((x) => x.id === id);
    setDragId(null);
    setDragOverIdx(null);
    if (img) moveTo(img, targetIdx);
  }

  function onDragEnd() {
    setDragId(null);
    setDragOverIdx(null);
  }

  async function refreshCatalogSnapshot() {
    if (!sku) return;
    try {
      const r = await getSkuCatalog(sku.id);
      setCatalog(r.catalog);
    } catch { /* 静默 */ }
  }

  // ---------- Tab3: 指导价 ----------
  async function savePrice() {
    if (!sku) return;
    setSaving(true);
    try {
      const cents = priceCents.trim() === '' ? null : Number(priceCents);
      if (cents !== null && (!Number.isInteger(cents) || cents < 0)) {
        alert('指导价必须为非负整数（分）');
        setSaving(false);
        return;
      }
      await updateSkuCatalog(sku.id, {
        guidePriceCents: cents ?? undefined,
        guidePriceCurrency: currency || 'BDT',
        guidePriceNote: priceNote.trim(),
      });
      setDirty(false);
      onSaved?.();
      await refreshCatalogSnapshot();
      alert(dict.skuEdit.saveOk);
    } catch (e) {
      alert(dict.skuEdit.saveFail.replace('{msg}', msgOf(e)));
    } finally {
      setSaving(false);
    }
  }

  const subtitle = useMemo(() => {
    if (!sku) return '';
    return dict.skuEdit.subtitle.replace('{sku}', sku.sku).replace('{model}', sku.modelName);
  }, [sku, dict]);

  if (!sku) return null;

  return (
    <Drawer open={open} onClose={closeWithConfirm} title={dict.skuEdit.title} subtitle={subtitle} width="lg">
      {loadErr && (
        <div className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
          加载失败：{loadErr}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
        {(
          [
            { key: 'basic' as Tab, label: dict.skuEdit.tabBasic },
            { key: 'images' as Tab, label: dict.skuEdit.tabImages },
            { key: 'price' as Tab, label: dict.skuEdit.tabPrice },
          ]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition ${
              tab === t.key
                ? 'border-matoo text-matoo-dark font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: 基本资料 */}
      {tab === 'basic' && (
        <div className="space-y-4">
          <Field label={dict.skuEdit.description}>
            {/* 工具栏：模式切换 + Markdown 快捷插入 */}
            <div className="mt-1 flex flex-wrap items-center gap-2 border border-slate-200 rounded-t-lg bg-slate-50 px-2 py-1.5">
              <div className="inline-flex rounded border border-slate-200 bg-white overflow-hidden">
                {(['edit', 'split', 'preview'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setDescMode(m)}
                    className={[
                      'px-2.5 py-1 text-xs transition',
                      descMode === m
                        ? 'bg-matoo text-white'
                        : 'text-slate-600 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    {m === 'edit'
                      ? dict.skuEdit.descriptionModeEdit
                      : m === 'split'
                        ? dict.skuEdit.descriptionModeSplit
                        : dict.skuEdit.descriptionModePreview}
                  </button>
                ))}
              </div>
              <div className="h-5 w-px bg-slate-200 mx-1" />
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => insertMarkdown('**{X}**', dict.skuEdit.descriptionInsertBold)}
                  className="px-2 py-0.5 text-xs font-bold text-slate-600 hover:text-matoo-dark border border-slate-200 rounded bg-white"
                  title={dict.skuEdit.descriptionInsertBold}
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('*{X}*', dict.skuEdit.descriptionInsertItalic)}
                  className="px-2 py-0.5 text-xs italic text-slate-600 hover:text-matoo-dark border border-slate-200 rounded bg-white"
                  title={dict.skuEdit.descriptionInsertItalic}
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('[{X}](https://)', dict.skuEdit.descriptionInsertLink)}
                  className="px-2 py-0.5 text-xs text-slate-600 hover:text-matoo-dark border border-slate-200 rounded bg-white"
                  title={dict.skuEdit.descriptionInsertLink}
                >
                  🔗
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('\n- {X}\n- \n', dict.skuEdit.descriptionInsertList)}
                  className="px-2 py-0.5 text-xs text-slate-600 hover:text-matoo-dark border border-slate-200 rounded bg-white"
                  title={dict.skuEdit.descriptionInsertList}
                >
                  •
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('`{X}`', dict.skuEdit.descriptionInsertCode)}
                  className="px-2 py-0.5 text-xs font-mono text-slate-600 hover:text-matoo-dark border border-slate-200 rounded bg-white"
                  title={dict.skuEdit.descriptionInsertCode}
                >
                  {'</>'}
                </button>
              </div>
            </div>
            {/* 编辑/预览 主体：split = 左右各一列，edit/preview = 单列 */}
            {descMode === 'split' ? (
              <div className="grid grid-cols-2 gap-2 border border-t-0 border-slate-200 rounded-b-lg overflow-hidden">
                <textarea
                  ref={descTaRef}
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
                  rows={12}
                  maxLength={5000}
                  placeholder={dict.skuEdit.descriptionPlaceholder}
                  className="input min-h-[280px] rounded-none border-0 focus:ring-0 font-mono text-sm"
                />
                <div className="p-3 bg-slate-50 min-h-[280px] overflow-auto">
                  {description.trim() ? (
                    <div className="md-preview">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">{dict.skuEdit.descriptionEmptyPreview}</p>
                  )}
                </div>
              </div>
            ) : descMode === 'edit' ? (
              <textarea
                ref={descTaRef}
                value={description}
                onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
                rows={12}
                maxLength={5000}
                placeholder={dict.skuEdit.descriptionPlaceholder}
                className="input mt-1 min-h-[280px] font-mono text-sm"
              />
            ) : (
              <div className="mt-1 p-4 border border-slate-200 rounded-lg bg-slate-50 min-h-[280px]">
                {description.trim() ? (
                  <div className="md-preview">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">{dict.skuEdit.descriptionEmptyPreview}</p>
                )}
              </div>
            )}
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
              <span>{dict.skuEdit.descriptionHint}</span>
              <span>{description.length} / 5000</span>
            </div>
          </Field>
          <Field label={dict.skuEdit.videoTrailerUrl}>
            <input
              type="url"
              value={videoTrailerUrl}
              onChange={(e) => { setVideoTrailerUrl(e.target.value); setDirty(true); }}
              placeholder={dict.skuEdit.videoTrailerPlaceholder}
              className="input mt-1"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <button onClick={closeWithConfirm} className="btn-ghost">取消</button>
            <button onClick={saveBasic} disabled={saving} className="btn-primary">
              {saving ? '保存中…' : dict.skuEdit.saveBasic}
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: 详情图片 */}
      {tab === 'images' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-[11px] uppercase tracking-wide text-slate-500">
              {dict.skuEdit.imageLang}
            </label>
            <select
              value={imageLang}
              onChange={(e) => setImageLang(e.target.value as SkuImageLang)}
              className="input max-w-[160px]"
            >
              {SKU_IMAGE_LANGS.map((l) => (
                <option key={l} value={l}>{LANG_LABEL[l]} ({l})</option>
              ))}
            </select>
            <label className="ml-auto btn-primary cursor-pointer">
              {bulkTasks.some((t) => t.status === 'uploading')
                ? dict.skuEdit.imageUpload + '…'
                : dict.skuEdit.imageBulkUpload}
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleBulkPick}
                disabled={bulkTasks.some((t) => t.status === 'uploading')}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-xs text-slate-500">{dict.skuEdit.imageBulkHint}</p>

          {/* 批量上传队列（未完成或刚完成的任务） */}
          {bulkTasks.length > 0 && (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
              {bulkTasks.map((t) => (
                <div key={t.id} className="px-3 py-2 text-xs flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono truncate text-slate-700">{t.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {(t.sizeBytes / 1024).toFixed(1)} KB
                      {t.error && <span className="ml-2 text-rose-600">· {t.error}</span>}
                    </div>
                    {t.status === 'uploading' && (
                      <div className="mt-1 h-1 w-full bg-slate-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-matoo transition-[width] duration-150"
                          style={{ width: `${t.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <span className="text-[11px]">
                    {t.status === 'done' && <span className="text-emerald-600">✓</span>}
                    {t.status === 'failed' && (
                      <button
                        onClick={() => retryBulkTask(t)}
                        className="text-matoo hover:underline"
                      >
                        {dict.skuEdit.imageBulkRetry}
                      </button>
                    )}
                    {t.status === 'uploading' && (
                      <span className="text-slate-500">{t.progress}%</span>
                    )}
                    {t.status === 'pending' && <span className="text-slate-400">…</span>}
                  </span>
                </div>
              ))}
              <div className="px-3 py-2 text-[11px] text-slate-500 flex items-center justify-between">
                <span>
                  {dict.skuEdit.imageBulkSuccess.replace(
                    '{n}',
                    String(bulkTasks.filter((t) => t.status === 'done').length),
                  )}
                  {bulkTasks.some((t) => t.status === 'failed') && (
                    <span className="ml-2 text-rose-600">
                      · {dict.skuEdit.imageBulkFailSummary.replace(
                        '{n}',
                        String(bulkTasks.filter((t) => t.status === 'failed').length),
                      )}
                    </span>
                  )}
                </span>
                {bulkTasks.every((t) => t.status !== 'uploading') && (
                  <button
                    onClick={() => setBulkTasks([])}
                    className="text-slate-500 hover:text-rose-600"
                  >
                    {dict.skuEdit.imageBulkRemove}
                  </button>
                )}
              </div>
            </div>
          )}

          {images.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
              {dict.skuEdit.imageEmpty}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{dict.skuEdit.imageReorderHint}</span>
                {reordering && (
                  <span className="text-matoo-dark">{dict.skuEdit.imageReorderSaving}</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img, idx) => {
                  const isDragging = dragId === img.id;
                  const dropBefore = dragOverIdx === idx && dragId !== null && dragId !== img.id;
                  const isFirst = idx === 0;
                  const isLast = idx === images.length - 1;
                  return (
                    <div
                      key={img.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, img.id)}
                      onDragOver={(e) => onDragOver(e, idx)}
                      onDrop={(e) => onDrop(e, idx)}
                      onDragEnd={onDragEnd}
                      className={[
                        'relative border rounded-lg overflow-hidden bg-white transition',
                        isDragging ? 'opacity-40 border-dashed border-matoo' : 'border-slate-200',
                        dropBefore ? 'ring-2 ring-matoo ring-offset-1' : '',
                        'cursor-move',
                      ].join(' ')}
                    >
                      {dropBefore && (
                        <div className="absolute -top-1 left-0 right-0 h-1 bg-matoo rounded-full z-10" />
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.alt ?? ''} className="w-full h-32 object-cover bg-slate-100" />
                      <div className="p-2 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-slate-400 truncate">
                            #{idx + 1} · {img.storageKey}
                          </span>
                          {img.isCover ? <span className="chip chip-green">★</span> : null}
                        </div>
                        <div className="text-slate-500">
                          {(img.sizeBytes / 1024).toFixed(1)} KB · {img.mimeType}
                        </div>
                        {/* 排序按钮 */}
                        <div className="flex items-center gap-1 pt-1 border-t border-slate-100">
                          <button
                            onClick={() => moveTo(img, 0)}
                            disabled={isFirst || reordering}
                            title={dict.skuEdit.imageMoveTop}
                            className="px-1.5 py-0.5 text-slate-500 hover:text-matoo-dark disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ⏮
                          </button>
                          <button
                            onClick={() => moveBy(img, -1)}
                            disabled={isFirst || reordering}
                            title={dict.skuEdit.imageMoveUp}
                            className="px-1.5 py-0.5 text-slate-500 hover:text-matoo-dark disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveBy(img, 1)}
                            disabled={isLast || reordering}
                            title={dict.skuEdit.imageMoveDown}
                            className="px-1.5 py-0.5 text-slate-500 hover:text-matoo-dark disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => moveTo(img, images.length - 1)}
                            disabled={isLast || reordering}
                            title={dict.skuEdit.imageMoveBottom}
                            className="px-1.5 py-0.5 text-slate-500 hover:text-matoo-dark disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ⏭
                          </button>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleSetCover(img)}
                            className="text-matoo hover:underline"
                          >
                            {img.isCover ? '取消主图' : dict.skuEdit.imageCover}
                          </button>
                          <button
                            onClick={() => handleDeprecate(img)}
                            className="text-rose-600 hover:underline ml-auto"
                          >
                            {dict.skuEdit.imageDeprecate}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 3: 指导价 */}
      {tab === 'price' && (
        <div className="space-y-4">
          <Field label={dict.skuEdit.priceCents}>
            <input
              type="number"
              min={0}
              step={1}
              value={priceCents}
              onChange={(e) => { setPriceCents(e.target.value); setDirty(true); }}
              placeholder="0"
              className="input mt-1"
            />
            <p className="text-[11px] text-slate-500 mt-1">{dict.skuEdit.priceHint}</p>
          </Field>
          <Field label={dict.skuEdit.priceCurrency}>
            <select
              value={currency}
              onChange={(e) => { setCurrency(e.target.value); setDirty(true); }}
              className="input mt-1 max-w-[200px]"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label={dict.skuEdit.priceNote}>
            <textarea
              value={priceNote}
              onChange={(e) => { setPriceNote(e.target.value); setDirty(true); }}
              placeholder={dict.skuEdit.priceNotePlaceholder}
              rows={3}
              maxLength={500}
              className="input mt-1 min-h-[80px]"
            />
          </Field>
          {catalog && (
            <div className="text-xs text-slate-500 pt-2 border-t border-slate-200">
              当前展示：
              <code className="ml-1 font-mono">
                {catalog.guidePriceCents != null
                  ? `${(catalog.guidePriceCents / 100).toFixed(2)} ${catalog.guidePriceCurrency ?? 'BDT'}`
                  : dict.skuEdit.priceEmpty}
              </code>
              {catalog.catalogUpdatedAt && (
                <span className="ml-3">
                  上次更新：{new Date(catalog.catalogUpdatedAt).toLocaleString('zh-CN')}
                </span>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <button onClick={closeWithConfirm} className="btn-ghost">取消</button>
            <button onClick={savePrice} disabled={saving} className="btn-primary">
              {saving ? '保存中…' : dict.skuEdit.savePrice}
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function msgOf(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}
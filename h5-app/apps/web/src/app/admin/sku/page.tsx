'use client';
// v1.3 P0:SKU 管理 4 Tab 主页
// Tab1 SKU 列表 / Tab2 批次管理 / Tab3 文档管理 / Tab4 QR 批量
// P1-4:所有硬编码已替换为 i18n key(t.adminSku.*)

import { useEffect, useState } from 'react';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar, AdminBreadcrumb } from '@/components/TopBar';
import { LangSwitch } from '@/components/LangSwitch';
import { PageLoading, Spinner } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { toast, toastSuccess } from '@/components/Toast';
import { useRequireRole, RoleGuardView } from '@/hooks/useRequireRole';
import { useAbortedFetch } from '@/hooks/useAbortedFetch';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { useT } from '@/lib/i18n';
import {
  listAdminSkus,
  listAdminSkuBatches,
  createAdminSkuBatch,
  deleteAdminSkuBatch,
  listAdminSkuDocuments,
  deleteAdminSkuDocument,
  downloadAdminSkuDocument,
  listAdminQrBatches,
  saveBlob,
  type SkuBatchItem,
  type SkuDocumentItem,
  type QrBatchItem,
} from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { AdminSkuTabs, type AdminSkuTab } from '@/components/admin/AdminSkuTabs';
import { SkuBatchForm } from '@/components/admin/SkuBatchForm';
import { DocumentUploadDrawer } from '@/components/admin/DocumentUploadDrawer';
import { QrBatchDialog } from '@/components/admin/QrBatchDialog';
import { DOC_TYPE_OPTIONS, LANG_OPTIONS } from '@/components/admin/LangChips';

// ============================================================
// 主页面
// ============================================================
export default function AdminSkuPage() {
  const { t } = useT();
  const guard = useRequireRole(['admin']);
  const [tab, setTab] = useState<AdminSkuTab>('list');

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title={t.adminSku.title} />;
  }

  return (
    <PhoneShell>
      <TopBar
        title={t.adminSku.title}
        leftExtra={<AdminBreadcrumb />}
        right={<LangSwitch />}
      />
      <main className="flex-1 overflow-auto pb-6">
        <div className="px-4 mt-3">
          <AdminSkuTabs active={tab} onChange={setTab} />
        </div>
        <div className="px-4">
          {tab === 'list' && <SkuListTab />}
          {tab === 'batches' && <SkuBatchesTab />}
          {tab === 'documents' && <SkuDocumentsTab />}
          {tab === 'qr' && <QrBatchTab />}
        </div>
      </main>
    </PhoneShell>
  );
}

// ============================================================
// Tab1:SKU 列表(只读 + 行内「上传文档 / 加入批次 / 撤销 QR」)
// ============================================================
function SkuListTab() {
  const { t } = useT();
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [docDrawerOpen, setDocDrawerOpen] = useState(false);
  const [preselectedSkuId, setPreselectedSkuId] = useState<string | undefined>(undefined);

  useAbortedFetch((signal) => {
    listAdminSkus({ q: search.trim() || undefined, pageSize: 50 }, { signal })
      .then((r) => setItems(r.items))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
  }, [search, reloadKey]);

  return (
    <section className="space-y-2">
      <div className="relative">
        <input
          type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t.adminSku.searchSkuPlaceholder} dir="auto"
          className="input pr-9" aria-label="search skus" />
        <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
      </div>
      {error != null && !items && (
        <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      )}
      {!error && !items && <PageLoading />}
      {!error && items && items.length === 0 && (
        <EmptyState icon="📦" title={t.adminSku.empty} hint={t.adminSku.emptySkuHint} />
      )}
      {items?.map((s: any) => (
        <div key={s.id} className="card p-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{s.modelName ?? s.sku}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">{s.sku} · {s.serial}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {t.adminSku.batchSummary
                  .replace('{batch}', s.batch ?? '—')
                  .replace('{capacity}', s.capacity ?? '—')
                  .replace('{state}', s.activated ? t.adminSku.activated : t.adminSku.notActivated)}
              </div>
            </div>
            <button
              onClick={() => { setPreselectedSkuId(s.id); setDocDrawerOpen(true); }}
              className="text-xs px-2 py-1 rounded bg-matoo text-white whitespace-nowrap"
            >
              {t.adminSku.uploadDoc}
            </button>
          </div>
        </div>
      ))}
      <DocumentUploadDrawer
        open={docDrawerOpen}
        onClose={() => setDocDrawerOpen(false)}
        onUploaded={() => setReloadKey((k) => k + 1)}
        skus={(items ?? []).map((s: any) => ({ id: s.id, sku: s.sku, modelName: s.modelName ?? '' }))}
        preselectedSkuId={preselectedSkuId}
      />
    </section>
  );
}

// ============================================================
// Tab2:批次管理
// ============================================================
function SkuBatchesTab() {
  const { t } = useT();
  const { formatDate } = useLocaleFormat();
  const [items, setItems] = useState<SkuBatchItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  useAbortedFetch((signal) => {
    listAdminSkuBatches({ q: search.trim() || undefined, pageSize: 50 }, { signal })
      .then((r) => setItems(r.items))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
  }, [search, reloadKey]);

  async function handleDelete(id: string, batchCode: string) {
    if (!confirm(t.adminSku.batchDeleteConfirm.replace('{batchCode}', batchCode))) return;
    try {
      await deleteAdminSkuBatch(id);
      toastSuccess(t.adminSku.batchDeleted);
      setReloadKey((k) => k + 1);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      toast(t.adminSku.deleteFailed.replace('{msg}', msg), 'error');
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t.adminSku.searchBatchPlaceholder} className="input pr-9"
            dir="auto" aria-label="search batches" />
          <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
        </div>
        <button onClick={() => setFormOpen(true)}
          className="px-4 py-2 text-sm bg-matoo text-white rounded-lg whitespace-nowrap">
          {t.adminSku.newBatch}
        </button>
      </div>

      {error != null && !items && (
        <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      )}
      {!error && !items && <PageLoading />}
      {!error && items && items.length === 0 && (
        <EmptyState icon="📦" title={t.adminSku.emptyBatches} hint={t.adminSku.emptyBatchesHint} />
      )}
      <div className="grid grid-cols-1 gap-2">
        {items?.map((b) => (
          <div key={b.id} className="card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold font-mono truncate">{b.batchCode}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {t.adminSku.batchMfg.replace('{date}', formatDate(b.mfgDate))}
                  {b.factory && ` · ${b.factory}`}
                  {b.destinationCountry && ` ${t.adminSku.batchDest.replace('{country}', b.destinationCountry)}`}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {t.adminSku.batchSkuCount
                    .replace('{count}', String(b.skuCount))
                    .replace('{docs}', String(b.documentCount))
                    .replace('{qr}', String(b.qrBatchCount))}
                  {b.totalQuantity > 0 && ` ${t.adminSku.batchPlanned.replace('{n}', String(b.totalQuantity))}`}
                </div>
                {b.note && <div className="text-[11px] text-slate-600 mt-1 line-clamp-2">{b.note}</div>}
              </div>
              <button onClick={() => handleDelete(b.id, b.batchCode)}
                className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50">
                {t.adminSku.delete}
              </button>
            </div>
          </div>
        ))}
      </div>

      <SkuBatchForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => { toastSuccess(t.adminSku.batchCreated); setReloadKey((k) => k + 1); }}
      />
    </section>
  );
}

// ============================================================
// Tab3:文档管理
// ============================================================
function SkuDocumentsTab() {
  const { t } = useT();
  const { formatDate } = useLocaleFormat();
  const [items, setItems] = useState<SkuDocumentItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filterType, setFilterType] = useState<string>('');
  const [filterLang, setFilterLang] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [skus, setSkus] = useState<Array<{ id: string; sku: string; modelName: string }>>([]);

  // 加载 SKU 列表(给上传抽屉用)
  useAbortedFetch((signal) => {
    listAdminSkus({ pageSize: 100 }, { signal })
      .then((r) => setSkus(r.items.map((s: any) => ({ id: s.id, sku: s.sku, modelName: s.modelName ?? '' }))))
      .catch(() => { /* silent - 抽屉打开时再拉 */ });
  }, []);

  useAbortedFetch((signal) => {
    setError(null);
    listAdminSkuDocuments({
      type: (filterType || undefined) as any,
      lang: (filterLang || undefined) as any,
      pageSize: 100,
    }, { signal })
      .then((r) => setItems(r.items))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
  }, [filterType, filterLang, reloadKey]);

  async function handleDelete(id: string, title: string) {
    if (!confirm(t.adminSku.docDeprecateConfirm.replace('{title}', title))) return;
    try {
      await deleteAdminSkuDocument(id);
      toastSuccess(t.adminSku.docDeprecated);
      setReloadKey((k) => k + 1);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      toast(t.adminSku.deprecateFailed.replace('{msg}', msg), 'error');
    }
  }

  async function handleDownload(id: string, fileName: string) {
    try {
      const blob = await downloadAdminSkuDocument(id);
      saveBlob(blob, fileName);
      toastSuccess(t.adminSku.uploadStarted);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      toast(t.adminSku.downloadFailed.replace('{msg}', msg), 'error');
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex gap-2 items-center">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="text-sm border border-slate-300 rounded px-2 py-2 bg-white"
          aria-label="filter by type">
          <option value="">{t.adminSku.allTypes}</option>
          {DOC_TYPE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.icon} {o.label}</option>)}
        </select>
        <select value={filterLang} onChange={(e) => setFilterLang(e.target.value)}
          className="text-sm border border-slate-300 rounded px-2 py-2 bg-white"
          aria-label="filter by language">
          <option value="">{t.adminSku.allLangs}</option>
          {LANG_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.flag} {o.label}</option>)}
        </select>
        <button onClick={() => setDrawerOpen(true)}
          className="ml-auto px-4 py-2 text-sm bg-matoo text-white rounded-lg whitespace-nowrap">
          {t.adminSku.uploadDoc}
        </button>
      </div>

      {error != null && !items && (
        <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      )}
      {!error && !items && <PageLoading />}
      {!error && items && items.length === 0 && (
        <EmptyState icon="📄" title={t.adminSku.emptyDocs} hint={t.adminSku.emptyDocsHint} />
      )}
      <div className="space-y-2">
        {items?.map((d) => {
          const typeMeta = DOC_TYPE_OPTIONS.find((o) => o.code === d.type);
          const langMeta = LANG_OPTIONS.find((o) => o.code === d.lang);
          return (
            <div key={d.id} className={`card p-3 ${d.deprecatedAt ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{d.title}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="chip text-[10px]">{typeMeta?.icon} {typeMeta?.label ?? d.type}</span>
                    <span className="chip text-[10px]">{langMeta?.flag} {langMeta?.label ?? d.lang}</span>
                    <span className="chip text-[10px] font-mono">v{d.version}</span>
                    {d.deprecatedAt && <span className="chip chip-red text-[10px]">{t.adminSku.deprecated}</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 truncate font-mono">{d.fileName}</div>
                  <div className="text-[11px] text-slate-500">
                    {t.adminSku.docSize.replace('{mb}', (d.sizeBytes / 1024 / 1024).toFixed(2))} · {t.adminSku.uploadedAt.replace('{date}', formatDate(d.uploadedAt))}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => handleDownload(d.id, d.fileName)}
                    className="text-xs px-2 py-1 rounded bg-matoo text-white whitespace-nowrap">{t.adminSku.download}</button>
                  {!d.deprecatedAt && (
                    <button onClick={() => handleDelete(d.id, d.title)}
                      className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 whitespace-nowrap">{t.adminSku.deprecated}</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <DocumentUploadDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onUploaded={() => { toastSuccess(t.adminSku.docUploaded); setReloadKey((k) => k + 1); }}
        skus={skus}
      />
    </section>
  );
}

// ============================================================
// Tab4:QR 批量
// ============================================================
function QrBatchTab() {
  const { t } = useT();
  const { formatDate } = useLocaleFormat();
  const [items, setItems] = useState<QrBatchItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [batches, setBatches] = useState<SkuBatchItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useAbortedFetch((signal) => {
    listAdminQrBatches({ pageSize: 50 }, { signal })
      .then((r) => setItems(r.items))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
  }, [reloadKey]);

  useAbortedFetch((signal) => {
    listAdminSkuBatches({ pageSize: 100 }, { signal })
      .then((r) => setBatches(r.items))
      .catch(() => { /* silent */ });
  }, []);

  async function handleDownload(task: QrBatchItem) {
    try {
      const { downloadAdminQrBatch } = await import('@/lib/api/operations');
      const blob = await downloadAdminQrBatch(task.id);
      saveBlob(blob, `qr-batch-${task.id}.zip`);
      toastSuccess(t.adminSku.uploadStarted);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      toast(t.adminSku.downloadFailed.replace('{msg}', msg), 'error');
    }
  }

  const qrStatusLabel = (s: string): string => {
    const map = t.adminSku.qrStatus as unknown as Record<string, string>;
    return map[s] ?? s;
  };

  return (
    <section className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setDialogOpen(true)}
          className="px-4 py-2 text-sm bg-matoo text-white rounded-lg whitespace-nowrap">
          {t.adminSku.newQrTask}
        </button>
      </div>

      {error != null && !items && (
        <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      )}
      {!error && !items && <PageLoading />}
      {!error && items && items.length === 0 && (
        <EmptyState icon="🔳" title={t.adminSku.emptyQr} hint={t.adminSku.emptyQrHint} />
      )}
      <div className="space-y-2">
        {items?.map((t2) => {
          const batch = batches.find((b) => b.id === t2.batchId);
          return (
            <div key={t2.id} className="card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono truncate">{batch?.batchCode ?? t2.batchId}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {t.adminSku.qrPlanned.replace('{n}', String(t2.totalQuantity)).replace('{m}', String(t2.generatedCount))}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {t.adminSku.qrCreated.replace('{date}', formatDate(t2.createdAt))}
                    {t2.finishedAt && ` ${t.adminSku.qrFinished.replace('{date}', formatDate(t2.finishedAt))}`}
                  </div>
                  {t2.errorMessage && (
                    <div className="text-[11px] text-red-600 mt-1">{t2.errorMessage}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`chip text-[10px] ${
                    t2.status === 'done' ? 'chip-green' :
                    t2.status === 'failed' ? 'chip-red' : 'chip-orange'
                  }`}>
                    {qrStatusLabel(t2.status)}
                    {t2.status === 'running' && (
                      <span className="ml-1 inline-block align-middle">
                        <Spinner size="sm" />
                      </span>
                    )}
                  </span>
                  {t2.status === 'done' && (
                    <button onClick={() => handleDownload(t2)}
                      className="text-xs px-2 py-1 rounded bg-matoo text-white whitespace-nowrap">{t.adminSku.downloadZip}</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <QrBatchDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onDone={() => setReloadKey((k) => k + 1)}
        batches={batches}
      />
    </section>
  );
}

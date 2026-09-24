// Admin SKU 资源三合一页面（Tab: 批次 / 文档 / QR）
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  listSkuBatches,
  createSkuBatch,
  updateSkuBatch,
  deleteSkuBatch,
  listSkuDocuments,
  deprecateSkuDocument,
  listQrBatches,
  listRevokedQrs,
  getSkuDocumentDownloadUrl,
  getQrBatchDownloadUrl,
  DOC_TYPES,
  DOC_LANGS,
  type SkuBatchWithStats,
  type SkuDocumentRow,
  type QrBatchRow,
  type RevokedQrItem,
  type DocType,
  type DocLang,
} from '@/lib/api/operations';
import { useRequireRole, RoleGuardView } from '@/lib/useRequireRole';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { SkuBatchFormDrawer } from '@/components/drawers/SkuBatchFormDrawer';
import { SkuDocumentUploadDrawer } from '@/components/drawers/SkuDocumentUploadDrawer';
import { QrBatchTriggerDrawer } from '@/components/drawers/QrBatchTriggerDrawer';
import { useLocale } from '@/lib/useLocale';
import { getDict } from '@/lib/i18n';

type Tab = 'batch' | 'document' | 'qr';

const DOC_TYPE_LABEL: Record<string, string> = {
  manual: '说明书',
  video: '视频',
  specsheet: '数据手册',
  faq: '常见问题',
};
const DOC_LANG_LABEL: Record<string, string> = {
  zh: '中文',
  en: '英文',
  bn: '孟加拉',
  hi: '印地',
  ur: '乌尔都',
};
const STATUS_CHIP: Record<string, string> = {
  pending: 'chip-gray',
  running: 'chip-blue',
  done: 'chip-green',
  failed: 'chip-red',
};

export default function AdminSkuResourcesPage() {
  const guard = useRequireRole(['admin']);
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const dict = getDict(locale);

  const [tab, setTab] = useState<Tab>('batch');
  // 来自 /admin/sku-list 的快捷定位
  const initialBatch = searchParams.get('batch') ?? '';
  const initialSku = searchParams.get('sku') ?? '';
  // ?batch= 后端未支持过滤，提示用户该参数被忽略（仅提示，不拦截）
  const [showBatchHint, setShowBatchHint] = useState(initialBatch.length > 0);

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title={dict.skuResources.title} />;
  }

  return (
    <div className="px-8 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{dict.skuResources.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{dict.skuResources.subtitle}</p>
      </header>

      {showBatchHint && (
        <div className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
          <span>⚠️</span>
          <span>
            URL 中包含 <code className="font-mono">?batch={initialBatch}</code>，但批次 Tab 暂不支持按 batchId 过滤（已忽略）。
          </span>
          <button
            onClick={() => setShowBatchHint(false)}
            className="ml-auto text-amber-700 hover:text-amber-900 text-xs"
          >
            知道了
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 mb-6 border-b border-slate-200">
        {(
          [
            { key: 'batch' as Tab, label: dict.skuResources.tabBatch },
            { key: 'document' as Tab, label: dict.skuResources.tabDocument },
            { key: 'qr' as Tab, label: dict.skuResources.tabQr },
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

      {tab === 'batch' && <BatchTab highlightBatchId={initialBatch} />}
      {tab === 'document' && <DocumentTab highlightSkuId={initialSku} />}
      {tab === 'qr' && <QrTab />}
    </div>
  );
}

/* =================== Tab1: 批次 =================== */
function BatchTab({ highlightBatchId }: { highlightBatchId: string }) {
  const [items, setItems] = useState<SkuBatchWithStats[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SkuBatchWithStats | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    listSkuBatches({ pageSize: 100 }, ac.signal)
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e as Error);
      });
    return () => ac.abort();
  }, [reloadKey]);

  async function handleDelete(b: SkuBatchWithStats) {
    if (!confirm(`删除批次 ${b.batchCode}？`)) return;
    try {
      await deleteSkuBatch(b.id);
      setReloadKey((k) => k + 1);
    } catch (e) {
      alert('删除失败: ' + (e as Error).message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-500">共 {total} 个批次</div>
        <button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="btn-primary"
        >
          + 新建批次
        </button>
      </div>

      {error && <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />}
      {!items && !error && <PageLoading />}
      {items && items.length === 0 && <EmptyState title="暂无批次" />}

      {items && items.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="table-th">批次号</th>
                <th className="table-th">生产日期</th>
                <th className="table-th">工厂</th>
                <th className="table-th">目的地</th>
                <th className="table-th">SKU</th>
                <th className="table-th">文档</th>
                <th className="table-th">QR</th>
                <th className="table-th">总数量</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr
                  key={b.id}
                  className={`hover:bg-slate-50/60 ${
                    highlightBatchId && b.id === highlightBatchId
                      ? 'bg-matoo-light/30'
                      : ''
                  }`}
                >
                  <td className="table-td">
                    <div className="font-medium">{b.batchCode}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{b.id}</div>
                  </td>
                  <td className="table-td text-xs">
                    {new Date(b.mfgDate).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="table-td text-xs">{b.factory ?? '—'}</td>
                  <td className="table-td">
                    <span className="font-mono text-xs">{b.destinationCountry ?? '—'}</span>
                  </td>
                  <td className="table-td text-sm">{b.skuCount}</td>
                  <td className="table-td text-sm">{b.documentCount}</td>
                  <td className="table-td text-sm">{b.qrBatchCount}</td>
                  <td className="table-td text-sm">{b.totalQuantity}</td>
                  <td className="table-td">
                    <div className="flex items-center gap-3 text-xs">
                      <button
                        onClick={() => {
                          setEditing(b);
                          setFormOpen(true);
                        }}
                        className="text-matoo hover:underline"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(b)}
                        className="text-rose-600 hover:underline"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SkuBatchFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
        onSubmit={async (body) => {
          if (editing) await updateSkuBatch(editing.id, body);
          else await createSkuBatch(body);
          setReloadKey((k) => k + 1);
        }}
      />
    </div>
  );
}

/* =================== Tab2: 文档 =================== */
function DocumentTab({ highlightSkuId }: { highlightSkuId: string }) {
  const [skuFilter, setSkuFilter] = useState(highlightSkuId);
  const [typeFilter, setTypeFilter] = useState<DocType | ''>('');
  const [langFilter, setLangFilter] = useState<DocLang | ''>('');
  const [includeDeprecated, setIncludeDeprecated] = useState(false);
  // #P2-4:排序方式(type=按文档类型预排; time=按上传时间)
  const [sortBy, setSortBy] = useState<'type' | 'time'>('type');
  const [items, setItems] = useState<SkuDocumentRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setError(null);
    listSkuDocuments(
      {
        skuId: skuFilter.trim() || undefined,
        type: typeFilter || undefined,
        lang: langFilter || undefined,
        includeDeprecated,
        sortBy,
        pageSize: 100,
      },
      ac.signal,
    )
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e as Error);
      });
    return () => ac.abort();
  }, [skuFilter, typeFilter, langFilter, includeDeprecated, sortBy, reloadKey]);

  async function handleDeprecate(d: SkuDocumentRow) {
    if (!confirm(`下架文档 ${d.title}？`)) return;
    try {
      await deprecateSkuDocument(d.id);
      setReloadKey((k) => k + 1);
    } catch (e) {
      alert('下架失败: ' + (e as Error).message);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          value={skuFilter}
          onChange={(e) => setSkuFilter(e.target.value)}
          placeholder="按 SKU ID 过滤"
          className="input max-w-[240px]"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as DocType | '')}
          className="input max-w-[140px]"
        >
          <option value="">全部类型</option>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOC_TYPE_LABEL[t] ?? t}
            </option>
          ))}
        </select>
        <select
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value as DocLang | '')}
          className="input max-w-[140px]"
        >
          <option value="">全部语言</option>
          {DOC_LANGS.map((l) => (
            <option key={l} value={l}>
              {DOC_LANG_LABEL[l] ?? l}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={includeDeprecated}
            onChange={(e) => setIncludeDeprecated(e.target.checked)}
            className="accent-matoo"
          />
          含已下架
        </label>
        {/* #P2-4:排序方式(type=预排; time=按上传时间倒序) */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'type' | 'time')}
          className="input max-w-[160px] py-1.5 text-xs"
          title="排序方式"
        >
          <option value="type">按类型预排</option>
          <option value="time">按上传时间</option>
        </select>
        <div className="ml-auto">
          <button onClick={() => setUploadOpen(true)} className="btn-primary">
            + 上传文档
          </button>
        </div>
      </div>

      <div className="text-sm text-slate-500 mb-3">共 {total} 条</div>

      {error && <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />}
      {!items && !error && <PageLoading />}
      {items && items.length === 0 && <EmptyState title="暂无文档" />}

      {items && items.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="table-th">SKU</th>
                <th className="table-th">类型 / 语言</th>
                <th className="table-th">版本</th>
                <th className="table-th">标题</th>
                <th className="table-th">文件名</th>
                <th className="table-th">大小</th>
                <th className="table-th">上传时间</th>
                <th className="table-th">状态</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr
                  key={d.id}
                  className={`hover:bg-slate-50/60 ${
                    d.deprecatedAt ? 'opacity-60' : ''
                  }`}
                >
                  <td className="table-td font-mono text-xs">{d.skuId}</td>
                  <td className="table-td">
                    <span className="chip chip-blue">{DOC_TYPE_LABEL[d.type] ?? d.type}</span>
                    <span className="chip chip-gray ml-1">{DOC_LANG_LABEL[d.lang] ?? d.lang}</span>
                  </td>
                  <td className="table-td text-xs font-mono">{d.version}</td>
                  <td className="table-td">
                    <div className="text-sm">{d.title}</div>
                  </td>
                  <td className="table-td text-xs font-mono">{d.fileName}</td>
                  <td className="table-td text-xs">
                    {(d.sizeBytes / 1024).toFixed(1)} KB
                  </td>
                  <td className="table-td text-xs text-slate-500">
                    {new Date(d.uploadedAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="table-td">
                    {d.deprecatedAt ? (
                      <span className="chip chip-red">已下架</span>
                    ) : (
                      <span className="chip chip-green">启用</span>
                    )}
                  </td>
                  <td className="table-td">
                    <div className="flex flex-col gap-1 text-xs">
                      <a
                        href={getSkuDocumentDownloadUrl(d.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-matoo hover:underline"
                      >
                        下载
                      </a>
                      {!d.deprecatedAt && (
                        <button
                          onClick={() => handleDeprecate(d)}
                          className="text-rose-600 hover:underline text-left"
                        >
                          下架
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SkuDocumentUploadDrawer
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        defaultSkuId={skuFilter}
        onDone={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}

/* =================== Tab3: QR =================== */
function QrTab() {
  const [tasks, setTasks] = useState<QrBatchRow[] | null>(null);
  const [revoked, setRevoked] = useState<RevokedQrItem[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [triggerOpen, setTriggerOpen] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setError(null);
    Promise.all([listQrBatches({ pageSize: 50 }, ac.signal), listRevokedQrs({ pageSize: 50 }, ac.signal)])
      .then(([t, r]) => {
        setTasks(t.items);
        setRevoked(r.items);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e as Error);
      });
    return () => ac.abort();
  }, [reloadKey]);

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            QR 批次任务
          </h2>
          <button onClick={() => setTriggerOpen(true)} className="btn-primary">
            + 生成 QR 批次
          </button>
        </div>

        {error && <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />}
        {!tasks && !error && <PageLoading />}
        {tasks && tasks.length === 0 && <EmptyState title="暂无 QR 批次" />}

        {tasks && tasks.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="table-th">任务 ID</th>
                  <th className="table-th">批次 ID</th>
                  <th className="table-th">状态</th>
                  <th className="table-th">生成进度</th>
                  <th className="table-th">创建时间</th>
                  <th className="table-th">完成时间</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="table-td font-mono text-xs">{t.id}</td>
                    <td className="table-td font-mono text-xs">{t.batchId}</td>
                    <td className="table-td">
                      <span className={`chip ${STATUS_CHIP[t.status] ?? 'chip-gray'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="table-td text-sm">
                      {t.generatedCount} / {t.totalQuantity}
                    </td>
                    <td className="table-td text-xs text-slate-500">
                      {new Date(t.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="table-td text-xs text-slate-500">
                      {t.finishedAt ? new Date(t.finishedAt).toLocaleString('zh-CN') : '—'}
                    </td>
                    <td className="table-td">
                      {t.status === 'done' && (
                        <a
                          href={getQrBatchDownloadUrl(t.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-matoo hover:underline"
                        >
                          下载 ZIP
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
          已撤销 QR ({revoked?.length ?? 0})
        </h2>
        {!revoked && <PageLoading />}
        {revoked && revoked.length === 0 && (
          <EmptyState title="暂无已撤销的 QR" />
        )}
        {revoked && revoked.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="table-th">QR ID</th>
                  <th className="table-th">SKU ID</th>
                  <th className="table-th">签名</th>
                  <th className="table-th">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {revoked.map((r) => (
                  <tr key={r.qrId} className="hover:bg-slate-50/60">
                    <td className="table-td font-mono text-xs">{r.qrId}</td>
                    <td className="table-td font-mono text-xs">{r.skuId}</td>
                    <td className="table-td font-mono text-[10px] truncate max-w-[260px]">
                      {r.signature}
                    </td>
                    <td className="table-td text-xs text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <QrBatchTriggerDrawer
        open={triggerOpen}
        onClose={() => setTriggerOpen(false)}
        onDone={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}
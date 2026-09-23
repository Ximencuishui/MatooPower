'use client';
// 管理员保修审核页 — 列表 + 状态过滤 + 审核 Drawer
// P1-4:所有硬编码已替换为 i18n key(t.adminWarranties.*)
import { useEffect, useRef, useState } from 'react';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar, AdminBreadcrumb } from '@/components/TopBar';
import { LangSwitch } from '@/components/LangSwitch';
import { PageLoading, Spinner } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { Drawer } from '@/components/Drawer';
import { useT } from '@/lib/i18n';
import { listAdminWarranties, reviewWarranty, downloadAdminWarrantiesCsv } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { toast, toastSuccess } from '@/components/Toast';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { useRequireRole, RoleGuardView } from '@/hooks/useRequireRole';
import { useAbortedFetch } from '@/hooks/useAbortedFetch';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import type { AdminWarrantyItem } from '@/lib/api/endpoints';

type Tab = 'all' | 'pending' | 'active' | 'rejected';

export default function AdminWarrantiesPage() {
  const { t } = useT();
  const { formatDate, formatCurrency } = useLocaleFormat();
  const guard = useRequireRole(['admin']);
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<AdminWarrantyItem[] | null>(null);
  const [selected, setSelected] = useState<AdminWarrantyItem | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  function load() {
    setError(null);
    setReloadKey((k) => k + 1);
  }

  // 搜索 debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // P0 UX-10:用 useAbortedFetch 取代裸 useEffect+load,组件卸载或切换 tab/搜索时取消
  useAbortedFetch((signal) => {
    if (guard.status !== 'ok') return;
    setError(null);
    const status = tab === 'all' ? undefined : tab;
    listAdminWarranties({ q: debouncedSearch.trim() || undefined, status, pageSize: 50 }, { signal })
      .then((r) => setItems(r.items))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
  }, [tab, debouncedSearch, guard.status, reloadKey]);

  // P0 UX-10:review 写操作也加 AbortController,组件卸载时取消未完成的请求
  const reviewCtrlRef = useRef<AbortController | null>(null);
  useEffect(() => () => { reviewCtrlRef.current?.abort(); }, []);

  function doReview(status: 'active' | 'pending' | 'rejected' | 'expired') {
    if (!selected) return;
    reviewCtrlRef.current?.abort();
    const ctrl = new AbortController();
    reviewCtrlRef.current = ctrl;
    setBusy(true);
    reviewWarranty(selected.id, { status, notes: notes || undefined }, { signal: ctrl.signal })
      .then((r) => {
        if (ctrl.signal.aborted) return;
        setSelected(r.warranty);
        setNotes('');
        toastSuccess(`${t.adminWarranties.reviewedDone} ✓`);
        load();
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.adminWarranties.reviewFailed);
        toast(msg, 'error');
      })
      .finally(() => { if (!ctrl.signal.aborted) setBusy(false); });
  }

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title={t.adminWarranties.title} />;
  }

  // 把后端返回的 status 字符串映射成 i18n key(英文)
  const statusLabel = (s: string) =>
    t.adminWarranties[`status_${s}` as keyof typeof t.adminWarranties] as string ?? s;

  return (
    <PhoneShell>
      <TopBar
        title={t.adminWarranties.title}
        leftExtra={<AdminBreadcrumb />}
        right={
          <>
            <ExportCsvButton
              filename={`admin-warranties-${new Date().toISOString().slice(0, 10)}`}
              fetch={() => downloadAdminWarrantiesCsv(debouncedSearch, tab === 'all' ? undefined : tab)}
              count={items?.length ?? 0}
            />
            <LangSwitch />
          </>
        }
      />

      <main className="flex-1 overflow-auto pb-6">
        <div className="px-4 mt-3">
          <form onSubmit={(e) => e.preventDefault()} className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.adminWarranties.searchPlaceholder}
              dir="auto"
              className="input pr-9"
              aria-label="search warranties"
            />
            <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">⌕</span>
          </form>
        </div>

        <div className="px-4 mt-2">
          <div role="tablist" className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            {([
              { k: 'pending' as Tab, l: t.adminWarranties.tabs.pending },
              { k: 'active' as Tab, l: t.adminWarranties.tabs.active },
              { k: 'rejected' as Tab, l: t.adminWarranties.tabs.rejected },
              { k: 'all' as Tab, l: t.adminWarranties.tabs.all },
            ]).map((tb) => (
              <button
                key={tb.k}
                role="tab"
                aria-selected={tab === tb.k}
                onClick={() => setTab(tb.k)}
                className={`flex-1 py-2 rounded-lg ${tab === tb.k ? 'bg-white dark:bg-slate-800 shadow-sm font-semibold' : 'text-slate-500'}`}
              >
                {tb.l}
              </button>
            ))}
          </div>
        </div>

        <section className="px-4 mt-3 space-y-2">
          {error != null && !items && <ErrorBlock error={error} onRetry={load} showLoginLink={error instanceof ApiError && error.status === 401} loginNext="/admin/warranties" />}
          {!error && !items && <PageLoading />}
          {!error && items && items.length === 0 && <EmptyState icon="🛡" title={t.adminWarranties.empty} />}
          {items?.map((w) => (
            <button key={w.id} onClick={() => setSelected(w)} className="card p-3 w-full text-left">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {w.s_modelName ?? w.s_sku ?? w.skuId}
                    <span className="ml-1 text-slate-400 dark:text-slate-500 font-mono text-xs">{w.s_serial ?? ''}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {w.user_displayName ?? w.user_phone ?? w.userId} · {w.country} {w.city ? `· ${w.city}` : ''}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {formatDate(w.createdAt)} → {formatDate(w.endAtWhole)}
                    {w.dealerName && ` · ${w.dealerName}`}
                  </div>
                </div>
                <span className={`chip text-[10px] ${
                  w.status === 'active' ? 'chip-green' :
                  w.status === 'rejected' ? 'chip-red' :
                  w.status === 'expired' ? 'chip-gray' : 'chip-orange'
                }`}>{statusLabel(w.status)}</span>
              </div>
            </button>
          ))}
        </section>
      </main>

      <Drawer open={!!selected} onClose={() => { setSelected(null); setNotes(''); }} title={t.adminWarranties.detailTitle}>
        {selected && (
          <div className="p-4 space-y-4">
            <div className="card p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t.adminWarranties.field_sku}</span><span className="font-mono">{selected.s_sku ?? selected.skuId}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t.adminWarranties.field_model}</span><span>{selected.s_modelName ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t.adminWarranties.field_serial}</span><span className="font-mono">{selected.s_serial ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t.adminWarranties.field_user}</span><span>{selected.user_displayName ?? selected.user_phone ?? selected.userId}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t.adminWarranties.field_region}</span><span>{selected.country} {selected.city && `· ${selected.city}`}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t.adminWarranties.field_dealer}</span><span>{selected.dealerName ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t.adminWarranties.field_invoiceNo}</span><span className="font-mono">{selected.invoiceNo ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t.adminWarranties.field_invoiceDate}</span><span>{selected.invoiceDate ? formatDate(selected.invoiceDate) : '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t.adminWarranties.field_invoiceAmount}</span><span>{selected.invoiceAmount != null ? formatCurrency(selected.invoiceAmount, 'BDT') : '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t.adminWarranties.field_status}</span><span className={`chip ${selected.status === 'active' ? 'chip-green' : selected.status === 'rejected' ? 'chip-red' : 'chip-orange'}`}>{statusLabel(selected.status)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t.adminWarranties.field_activatedAt}</span><span>{formatDate(selected.startAt)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t.adminWarranties.field_warrantyEnd}</span><span>{formatDate(selected.endAtWhole)}</span></div>
              {selected.reviewNotes && (
                <div className="pt-2 border-t dark:border-slate-700">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t.adminWarranties.notes_reviewed}</div>
                  <div className="text-sm">{selected.reviewNotes}</div>
                </div>
              )}
            </div>

            <div>
              <label className="label">{t.adminWarranties.notes_label}</label>
              <textarea
                className="input min-h-[80px] py-2"
                placeholder={t.adminWarranties.notes_placeholder}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={busy}
                maxLength={500}
                dir="auto"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => doReview('active')} disabled={busy} className="btn-primary text-sm inline-flex items-center justify-center gap-2">
                {busy && <Spinner size="sm" />}{t.adminWarranties.actions_approve}
              </button>
              <button onClick={() => doReview('rejected')} disabled={busy} className="btn-secondary text-red-600 dark:text-red-400 text-sm inline-flex items-center justify-center gap-2">
                {busy && <Spinner size="sm" />}{t.adminWarranties.actions_reject}
              </button>
              <button onClick={() => doReview('pending')} disabled={busy} className="btn-ghost text-sm">{t.adminWarranties.actions_pending}</button>
              <button onClick={() => doReview('expired')} disabled={busy} className="btn-ghost text-slate-500 dark:text-slate-400 text-sm">{t.adminWarranties.actions_expired}</button>
            </div>
          </div>
        )}
      </Drawer>
    </PhoneShell>
  );
}

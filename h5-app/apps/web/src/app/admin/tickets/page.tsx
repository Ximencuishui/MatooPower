'use client';
// P1-6:客服工作台详情改用 Drawer 全屏覆盖(同区域累积)
import { useEffect, useMemo, useRef, useState } from 'react';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar, AdminBreadcrumb } from '@/components/TopBar';
import { LangSwitch } from '@/components/LangSwitch';
import { PageLoading, Spinner } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { Drawer } from '@/components/Drawer';
import { useT } from '@/lib/i18n';
import { listAllTickets, getTicketDetail, replyTicket, updateTicket, getTicketStats, downloadAdminTicketsCsv } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { toast, toastSuccess } from '@/components/Toast';
import { getSession } from '@/lib/api/auth-store';
import type { TicketItem, TicketStatus, TicketStatsDto, TicketDetail } from '@/lib/api/endpoints';
import { useRequireRole, RoleGuardView } from '@/hooks/useRequireRole';
import { useAbortedFetch } from '@/hooks/useAbortedFetch';

type Tab = 'all' | 'open' | 'urgent' | 'resolved';

const SEVERITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export default function AdminTicketsPage() {
  const { t } = useT();
  const guard = useRequireRole(['admin', 'support']);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [tickets, setTickets] = useState<TicketItem[] | null>(null);
  const [stats, setStats] = useState<TicketStatsDto['stats'] | null>(null);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<unknown>(null);

  const [replyText, setReplyText] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [busy, setBusy] = useState(false);
  // P1-9:手动重载计数器 — onRetry 时递增,触发 useAbortedFetch 重新执行
  const [reloadKey, setReloadKey] = useState(0);
  function load() {
    setError(null);
    setReloadKey((k) => k + 1);
  }

  // P1-9:search debounce 300ms
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // 单一触发源:tab / 搜索 debounce / 角色守卫 / 手动 reload — 合并为 useAbortedFetch,
  // 避免 useEffect+load 与 useAbortedFetch 双触发同一个 fetch 浪费一次网络往返
  useAbortedFetch((signal) => {
    setError(null);
    if (guard.status !== 'ok') return;
    const statusFilter = tab === 'open' ? 'in_progress' : tab === 'resolved' ? 'resolved' : undefined;
    Promise.all([
      listAllTickets({ status: statusFilter, q: debouncedSearch.trim() || undefined }, { signal }),
      getTicketStats({ signal }),
    ])
      .then(([t, st]) => {
        setTickets(t.items);
        setStats(st.stats);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
  }, [tab, debouncedSearch, guard.status, reloadKey]);

  // P0 UX-10:openDetail/doReply/doUpdate 也用 AbortController 包裹,
  // 组件卸载或切换 ticket 时取消未完成的请求,避免对已卸载组件 setState
  const detailCtrlRef = useRef<AbortController | null>(null);
  function openDetail(id: string) {
    detailCtrlRef.current?.abort();
    const ctrl = new AbortController();
    detailCtrlRef.current = ctrl;
    setBusy(true);
    getTicketDetail(id, { signal: ctrl.signal })
      .then((r) => { if (!ctrl.signal.aborted) { setSelected(r.ticket); setReplyText(''); setResolutionText(''); } })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.common.networkErr);
        setError(msg);
        toast(msg, 'error');
      })
      .finally(() => { if (!ctrl.signal.aborted) setBusy(false); });
  }

  function doReply() {
    if (!selected || !replyText.trim()) return;
    detailCtrlRef.current?.abort();
    const ctrl = new AbortController();
    detailCtrlRef.current = ctrl;
    setBusy(true);
    replyTicket(selected.id, replyText.trim(), { signal: ctrl.signal })
      .then(() => getTicketDetail(selected.id, { signal: ctrl.signal }))
      .then((r) => { if (!ctrl.signal.aborted) { setSelected(r.ticket); setReplyText(''); toastSuccess(t.ticket.replySend + ' ?'); } })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.common.networkErr);
        toast(msg, 'error');
      })
      .finally(() => { if (!ctrl.signal.aborted) setBusy(false); });
  }

  function doUpdate(status: TicketStatus) {
    if (!selected) return;
    detailCtrlRef.current?.abort();
    const ctrl = new AbortController();
    detailCtrlRef.current = ctrl;
    setBusy(true);
    const resolution = status === 'resolved' || status === 'closed' ? (resolutionText || selected.resolution || undefined) : undefined;
    updateTicket(selected.id, { status, resolution }, { signal: ctrl.signal })
      .then(() => getTicketDetail(selected.id, { signal: ctrl.signal }))
      .then((r) => { if (!ctrl.signal.aborted) { setSelected(r.ticket); setResolutionText(''); } })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.common.networkErr);
        toast(msg, 'error');
      })
      .finally(() => { if (!ctrl.signal.aborted) setBusy(false); });
  }

  // 组件卸载时清空进行中的 detail 请求
  useEffect(() => () => { detailCtrlRef.current?.abort(); }, []);

  // P1-10:紧急工单置顶
  const filtered = useMemo(() => {
    if (!tickets) return null;
    const arr = tab === 'urgent' ? tickets.filter((x) => x.severity === 'high' || x.severity === 'urgent') : tickets;
    return [...arr].sort((a, b) => {
      const ra = SEVERITY_RANK[a.severity] ?? 9;
      const rb = SEVERITY_RANK[b.severity] ?? 9;
      if (ra !== rb) return ra - rb;
      return a.updatedAt < b.updatedAt ? 1 : -1;
    });
  }, [tickets, tab]);

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title={t.ticket.adminTitle} />;
  }

  return (
    <PhoneShell>
      <TopBar
        title={t.ticket.adminTitle}
        leftExtra={<AdminBreadcrumb />}
        right={
          <>
            <ExportCsvButton
              filename={`admin-tickets-${new Date().toISOString().slice(0, 10)}`}
              fetch={() => downloadAdminTicketsCsv(
                debouncedSearch,
                tab === 'open' ? 'in_progress' : tab === 'resolved' ? 'resolved' : undefined,
              )}
              count={tickets?.length ?? 0}
            />
            <LangSwitch />
          </>
        }
      />

      <main className="flex-1 overflow-auto pb-6">
        {stats && (
          <section className="p-4">
            <div className="grid grid-cols-3 gap-2">
              <OverviewStat label={t.ticket.kpiOpen} value={stats.open} highlight={stats.urgent > 0} />
              <OverviewStat label={t.ticket.kpiUrgent} value={stats.urgent} highlight={stats.urgent > 0} />
              <OverviewStat label={t.ticket.kpiTodayNew} value={stats.todayNew} />
            </div>
          </section>
        )}

        {/* 搜索 */}
        <div className="px-4 mb-2">
          <form onSubmit={(e) => e.preventDefault()} className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.ticket.searchPlaceholder}
              dir="auto"
              className="input pr-9"
              aria-label="search tickets"
            />
            <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">?</span>
          </form>
        </div>

        <div className="px-4">
          <div role="tablist" className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            {([
              { k: 'all' as Tab, l: t.ticket.tabAll },
              { k: 'open' as Tab, l: t.ticket.tabOpen },
              { k: 'urgent' as Tab, l: t.ticket.tabUrgent },
              { k: 'resolved' as Tab, l: t.ticket.tabResolved },
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
          {error != null && !tickets && <ErrorBlock error={error} onRetry={load} showLoginLink={error instanceof ApiError && error.status === 401} loginNext="/admin/tickets" />}
          {!error && !filtered && <PageLoading />}
          {!error && filtered && filtered.length === 0 && (
            <EmptyState icon="??" title={t.ticket.empty} />
          )}
          {filtered?.map((tk) => {
            const isUrgent = tk.severity === 'urgent' || tk.severity === 'high';
            return (
              <button key={tk.id} onClick={() => openDetail(tk.id)} className={`card p-3 w-full text-left ${isUrgent ? 'urgent-border' : ''}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {isUrgent && <span aria-label="urgent" className="mr-1">??</span>}
                      {tk.subject}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {tk.sku ? `${tk.sku} · ${tk.serial}` : t.ticket.noSubjectDevice}
                      {tk.assigneeName ? ` · @${tk.assigneeName}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`chip text-[10px] ${
                      tk.status === 'resolved' || tk.status === 'closed' ? 'chip-green'
                      : isUrgent ? 'chip-red'
                      : 'chip-orange'
                    }`}>{t.ticket[`status_${tk.status}` as keyof typeof t.ticket] as string}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{tk.messageCount} ??</span>
                  </div>
                </div>
              </button>
            );
          })}
        </section>
      </main>

      {/* P1-6:详情用 Drawer 全屏覆盖 */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={t.ticket.detailTitle}>
        {selected && (
          <div className="p-4 space-y-4">
            <div className="card p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold">{selected.subject}</h3>
                <span className={`chip ${selected.status === 'resolved' || selected.status === 'closed' ? 'chip-green' : 'chip-orange'}`}>
                  {t.ticket[`status_${selected.status}` as keyof typeof t.ticket] as string}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                {selected.author?.displayName ?? '—'} · {selected.sku ? `${selected.sku} ${selected.serial ?? ''}` : t.ticket.noSubjectDevice}
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 whitespace-pre-wrap">{selected.description}</p>

              <div className="border-t dark:border-slate-700 pt-3 mt-3">
                <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">{t.ticket.conversation}</h4>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {selected.messages.map((m) => (
                    <div key={m.id} className={`text-sm rounded-lg p-2 ${
                      m.senderRole === 'support' ? 'bg-matoo-light text-matoo-dark ml-4' :
                      m.senderRole === 'system' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs italic' :
                      'bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 mr-4'
                    }`}>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">
                        {m.senderRole === 'support' ? (
                          <><span aria-hidden="true">??</span> Support</>
                        ) : m.senderRole === 'system' ? (
                          <><span aria-hidden="true">?</span> System</>
                        ) : (
                          <><span aria-hidden="true">??</span> Customer</>
                        )}
                        {' · '}
                        {new Date(m.createdAt).toLocaleString()}
                      </div>
                      {m.body}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <textarea
                  className="input min-h-[80px] py-2"
                  placeholder={t.ticket.replyPlaceholder}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={busy}
                  maxLength={1000}
                  dir="auto"
                />
                <button onClick={doReply} disabled={busy || !replyText.trim()} className="btn-primary mt-2 inline-flex items-center justify-center gap-2">
                  {busy ? <Spinner size="sm" /> : null}
                  {busy ? t.common.loading : t.ticket.replySend}
                </button>
              </div>

              <div className="mt-4 pt-3 border-t dark:border-slate-700">
                <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">{t.ticket.changeStatus}</h4>
                <textarea
                  className="input min-h-[60px] py-2 mb-2"
                  placeholder={t.ticket.resolutionPlaceholder}
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  disabled={busy}
                  maxLength={500}
                  dir="auto"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => doUpdate('in_progress')} disabled={busy} className="btn-secondary text-sm">{t.ticket.setInProgress}</button>
                  <button onClick={() => doUpdate('waiting_customer')} disabled={busy} className="btn-secondary text-sm">{t.ticket.setWaiting}</button>
                  <button onClick={() => doUpdate('resolved')} disabled={busy} className="btn-primary text-sm">{t.ticket.setResolved}</button>
                  <button onClick={() => doUpdate('closed')} disabled={busy} className="btn-ghost text-red-600 dark:text-red-400 text-sm">{t.ticket.setClosed}</button>
                </div>
                {/* 状态按钮分级:已解决/关闭 → 强调色;进行中 → 二级;等待客户 → 二级 */}
                <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500 text-center">
                  {t.ticket.changeStatusHint ?? '提示:resolved 表示客户问题已解决;closed 表示归档不再处理'}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </PhoneShell>
  );
}

function OverviewStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`card p-3 text-center ${highlight ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : ''}`}>
      <div className="text-[10px] text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-bold ${highlight ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100'}`}>{value}</div>
    </div>
  );
}
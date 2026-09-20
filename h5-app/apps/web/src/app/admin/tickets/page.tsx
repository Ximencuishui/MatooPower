'use client';
// P1-6:客服工作台详情改用 Drawer 全屏覆盖(同区域累积)
import { useEffect, useMemo, useState } from 'react';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { LangSwitch } from '@/components/LangSwitch';
import { PageLoading, Spinner } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { Drawer } from '@/components/Drawer';
import { useT } from '@/lib/i18n';
import { listAllTickets, getTicketDetail, replyTicket, updateTicket, getAdminOverview } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { toast, toastSuccess } from '@/components/Toast';
import { getSession } from '@/lib/api/auth-store';
import type { TicketItem, TicketStatus, AdminOverviewDto, TicketDetail } from '@/lib/api/endpoints';

type Tab = 'all' | 'open' | 'urgent' | 'resolved';

const SEVERITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export default function AdminTicketsPage() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [tickets, setTickets] = useState<TicketItem[] | null>(null);
  const [overview, setOverview] = useState<AdminOverviewDto['overview'] | null>(null);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<unknown>(null);

  const [replyText, setReplyText] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    setError(null);
    const s = getSession();
    if (!s?.token) {
      setError(new ApiError(401, 'UNAUTHORIZED', t.ticket.needLoginAdmin));
      return;
    }

    const statusFilter = tab === 'open' ? 'in_progress' : tab === 'resolved' ? 'resolved' : undefined;
    Promise.all([
      listAllTickets({ status: statusFilter, q: search.trim() || undefined }),
      getAdminOverview(),
    ])
      .then(([t, ov]) => {
        setTickets(t.items);
        setOverview(ov.overview);
      })
      .catch((e: unknown) => setError(e));
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab, search]);

  function openDetail(id: string) {
    setBusy(true);
    getTicketDetail(id)
      .then((r) => { setSelected(r.ticket); setReplyText(''); setResolutionText(''); })
      .catch((e: unknown) => {
        const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.common.networkErr);
        setError(msg);
        toast(msg, 'error');
      })
      .finally(() => setBusy(false));
  }

  function doReply() {
    if (!selected || !replyText.trim()) return;
    setBusy(true);
    replyTicket(selected.id, replyText.trim())
      .then(() => getTicketDetail(selected.id))
      .then((r) => { setSelected(r.ticket); setReplyText(''); toastSuccess(t.ticket.replySend + ' ✓'); })
      .catch((e: unknown) => {
        const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.common.networkErr);
        toast(msg, 'error');
      })
      .finally(() => setBusy(false));
  }

  function doUpdate(status: TicketStatus) {
    if (!selected) return;
    setBusy(true);
    const resolution = status === 'resolved' || status === 'closed' ? (resolutionText || selected.resolution || undefined) : undefined;
    updateTicket(selected.id, { status, resolution })
      .then(() => getTicketDetail(selected.id))
      .then((r) => { setSelected(r.ticket); setResolutionText(''); })
      .catch((e: unknown) => {
        const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.common.networkErr);
        toast(msg, 'error');
      })
      .finally(() => setBusy(false));
  }

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

  return (
    <PhoneShell>
      <TopBar title={t.ticket.adminTitle} right={<LangSwitch />} />

      <main className="flex-1 overflow-auto pb-6">
        {overview && (
          <section className="p-4">
            <div className="grid grid-cols-3 gap-2">
              <OverviewStat label={t.ticket.kpiOpen} value={overview.ticket.open} highlight={overview.ticket.urgent > 0} />
              <OverviewStat label={t.ticket.kpiUrgent} value={overview.ticket.urgent} highlight={overview.ticket.urgent > 0} />
              <OverviewStat label={t.ticket.kpiThisMonth} value={overview.ticket.newThisMonth} />
            </div>
          </section>
        )}

        {/* 搜索 */}
        <div className="px-4 mb-2">
          <div className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.ticket.searchPlaceholder}
              className="input pr-9"
              aria-label="search tickets"
            />
            <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">⌕</span>
          </div>
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
                className={`flex-1 py-2 rounded-lg ${tab === tb.k ? 'bg-white dark:bg-slate-700 shadow-sm font-semibold' : 'text-slate-500'}`}
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
            <EmptyState icon="🎫" title={t.ticket.empty} />
          )}
          {filtered?.map((tk) => {
            const isUrgent = tk.severity === 'urgent' || tk.severity === 'high';
            return (
              <button key={tk.id} onClick={() => openDetail(tk.id)} className={`card p-3 w-full text-left ${isUrgent ? 'urgent-border' : ''}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {isUrgent && <span aria-label="urgent" className="mr-1">🔴</span>}
                      {tk.subject}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
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
                    <span className="text-[10px] text-slate-400">{tk.messageCount} 💬</span>
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
              <div className="text-[11px] text-slate-500 mb-2">
                {selected.author?.displayName ?? '—'} · {selected.sku ? `${selected.sku} ${selected.serial ?? ''}` : t.ticket.noSubjectDevice}
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 whitespace-pre-wrap">{selected.description}</p>

              <div className="border-t dark:border-slate-700 pt-3 mt-3">
                <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">{t.ticket.conversation}</h4>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {selected.messages.map((m) => (
                    <div key={m.id} className={`text-sm rounded-lg p-2 ${
                      m.senderRole === 'support' ? 'bg-matoo-light text-matoo-dark ml-4' :
                      m.senderRole === 'system' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs italic' :
                      'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 mr-4'
                    }`}>
                      <div className="text-[10px] text-slate-400 mb-1">
                        {m.senderRole === 'support' ? '🛠 Support' : m.senderRole === 'system' ? '⚙ System' : '👤 Customer'}
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
                />
                <button onClick={doReply} disabled={busy || !replyText.trim()} className="btn-primary mt-2 inline-flex items-center justify-center gap-2">
                  {busy ? <Spinner size="sm" /> : null}
                  {busy ? t.common.loading : t.ticket.replySend}
                </button>
              </div>

              <div className="mt-4 pt-3 border-t dark:border-slate-700">
                <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">{t.ticket.changeStatus}</h4>
                <textarea
                  className="input min-h-[60px] py-2 mb-2"
                  placeholder={t.ticket.resolutionPlaceholder}
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  disabled={busy}
                  maxLength={500}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => doUpdate('in_progress')} disabled={busy} className="btn-secondary text-sm">{t.ticket.setInProgress}</button>
                  <button onClick={() => doUpdate('waiting_customer')} disabled={busy} className="btn-secondary text-sm">{t.ticket.setWaiting}</button>
                  <button onClick={() => doUpdate('resolved')} disabled={busy} className="btn-primary text-sm">{t.ticket.setResolved}</button>
                  <button onClick={() => doUpdate('closed')} disabled={busy} className="btn-ghost text-sm">{t.ticket.setClosed}</button>
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
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${highlight ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100'}`}>{value}</div>
    </div>
  );
}

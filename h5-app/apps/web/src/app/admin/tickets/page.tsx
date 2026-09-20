'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { LangSwitch } from '@/components/LangSwitch';
import { useT } from '@/lib/i18n';
import { listAllTickets, getTicketDetail, replyTicket, updateTicket, getAdminOverview } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { getSession } from '@/lib/api/auth-store';
import type { TicketItem, TicketStatus, TicketSeverity, AdminOverviewDto, TicketDetail } from '@/lib/api/endpoints';

type Tab = 'all' | 'open' | 'urgent' | 'resolved';

export default function AdminTicketsPage() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [tickets, setTickets] = useState<TicketItem[] | null>(null);
  const [overview, setOverview] = useState<AdminOverviewDto['overview'] | null>(null);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 详情面板输入
  const [replyText, setReplyText] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s?.token) {
      setError(t.ticket.needLoginAdmin);
      return;
    }

    const statusFilter = tab === 'open' ? 'in_progress' : tab === 'resolved' ? 'resolved' : undefined;
    Promise.all([
      listAllTickets({
        status: statusFilter,
        q: search.trim() || undefined,
      }),
      getAdminOverview(),
    ])
      .then(([t, ov]) => {
        setTickets(t.items);
        setOverview(ov.overview);
      })
      .catch((e: unknown) => {
        setError(e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.common.networkErr));
      });
  }, [tab, search, t.common.networkErr, t.ticket.needLoginAdmin]);

  function openDetail(id: string) {
    setBusy(true);
    getTicketDetail(id)
      .then((r) => { setSelected(r.ticket); setReplyText(''); setResolutionText(''); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t.common.networkErr))
      .finally(() => setBusy(false));
  }

  function doReply() {
    if (!selected || !replyText.trim()) return;
    setBusy(true);
    replyTicket(selected.id, replyText.trim())
      .then(() => getTicketDetail(selected.id))
      .then((r) => { setSelected(r.ticket); setReplyText(''); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t.common.networkErr))
      .finally(() => setBusy(false));
  }

  function doUpdate(status: TicketStatus) {
    if (!selected) return;
    setBusy(true);
    const resolution = status === 'resolved' || status === 'closed' ? (resolutionText || selected.resolution || undefined) : undefined;
    updateTicket(selected.id, { status, resolution })
      .then(() => getTicketDetail(selected.id))
      .then((r: { ticket: TicketDetail }) => { setSelected(r.ticket); setResolutionText(''); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t.common.networkErr))
      .finally(() => setBusy(false));
  }

  if (error && !tickets) {
    return (
      <PhoneShell>
        <TopBar title={t.ticket.adminTitle} />
        <main className="p-5">
          <div role="alert" className="card p-4 text-sm text-red-600 bg-red-50">{error}</div>
        </main>
      </PhoneShell>
    );
  }

  const filtered = tickets?.filter((t) => {
    if (tab === 'urgent') return t.severity === 'high' || t.severity === 'urgent';
    return true;
  });

  return (
    <PhoneShell>
      <TopBar title={t.ticket.adminTitle} right={<LangSwitch />} />

      <main className="flex-1 overflow-auto pb-6">
        {/* 概览 */}
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
              aria-label="search"
            />
            <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">⌕</span>
          </div>
        </div>

        {/* tab 切换 */}
        <div className="px-4">
          <div role="tablist" className="flex bg-slate-100 p-1 rounded-xl text-xs">
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
                className={`flex-1 py-2 rounded-lg ${tab === tb.k ? 'bg-white shadow-sm font-semibold' : 'text-slate-500'}`}
              >
                {tb.l}
              </button>
            ))}
          </div>
        </div>

        {/* 工单列表 */}
        <section className="px-4 mt-3 space-y-2">
          {!filtered && <div className="text-center text-slate-400 text-sm py-8">{t.scan.loadingHint}</div>}
          {filtered && filtered.length === 0 && (
            <div className="card p-8 text-center text-slate-500 text-sm">{t.ticket.empty}</div>
          )}
          {filtered?.map((tk) => (
            <button key={tk.id} onClick={() => openDetail(tk.id)} className="card p-3 w-full text-left">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{tk.subject}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {tk.sku ? `${tk.sku} · ${tk.serial}` : t.ticket.noSubjectDevice}
                    {tk.assigneeName ? ` · @${tk.assigneeName}` : ''}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`chip text-[10px] ${
                    tk.status === 'resolved' || tk.status === 'closed' ? 'chip-green'
                    : tk.severity === 'urgent' || tk.severity === 'high' ? 'chip-red'
                    : 'chip-orange'
                  }`}>{t.ticket[`status_${tk.status}` as keyof typeof t.ticket] as string}</span>
                  <span className="text-[10px] text-slate-400">{tk.messageCount} 💬</span>
                </div>
              </div>
            </button>
          ))}
        </section>

        {/* 详情抽屉（简化：在主区域下方） */}
        {selected && (
          <section className="px-4 mt-4">
            <div className="card p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold">{selected.subject}</h3>
                <button onClick={() => setSelected(null)} aria-label="close" className="text-slate-400 text-sm">×</button>
              </div>
              <div className="text-[11px] text-slate-500 mb-2">
                {selected.author?.displayName ?? '—'} · {selected.sku ? `${selected.sku} ${selected.serial ?? ''}` : t.ticket.noSubjectDevice}
              </div>
              <p className="text-sm text-slate-700 mb-3 whitespace-pre-wrap">{selected.description}</p>

              <div className="border-t pt-3 mt-3">
                <h4 className="text-xs font-semibold text-slate-600 mb-2">{t.ticket.conversation}</h4>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {selected.messages.map((m) => (
                    <div key={m.id} className={`text-sm rounded-lg p-2 ${
                      m.senderRole === 'support' ? 'bg-matoo-light text-matoo-dark ml-4' :
                      m.senderRole === 'system' ? 'bg-slate-100 text-slate-500 text-xs italic' :
                      'bg-slate-50 text-slate-700 mr-4'
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

              {/* 回复 */}
              <div className="mt-3">
                <textarea
                  className="input min-h-[80px] py-2"
                  placeholder={t.ticket.replyPlaceholder}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={busy}
                />
                <button onClick={doReply} disabled={busy || !replyText.trim()} className="btn-primary mt-2">
                  {t.ticket.replySend}
                </button>
              </div>

              {/* 状态切换 */}
              <div className="mt-4 pt-3 border-t">
                <h4 className="text-xs font-semibold text-slate-600 mb-2">{t.ticket.changeStatus}</h4>
                <textarea
                  className="input min-h-[60px] py-2 mb-2"
                  placeholder={t.ticket.resolutionPlaceholder}
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  disabled={busy}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => doUpdate('in_progress')} disabled={busy} className="btn-secondary text-sm">{t.ticket.setInProgress}</button>
                  <button onClick={() => doUpdate('waiting_customer')} disabled={busy} className="btn-secondary text-sm">{t.ticket.setWaiting}</button>
                  <button onClick={() => doUpdate('resolved')} disabled={busy} className="btn-primary text-sm">{t.ticket.setResolved}</button>
                  <button onClick={() => doUpdate('closed')} disabled={busy} className="btn-ghost text-sm">{t.ticket.setClosed}</button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </PhoneShell>
  );
}

function OverviewStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`card p-3 text-center ${highlight ? 'bg-amber-50 border-amber-200' : ''}`}>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${highlight ? 'text-amber-700' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}
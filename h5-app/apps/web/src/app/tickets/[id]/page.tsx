'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { PageLoading, Spinner } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { useT } from '@/lib/i18n';
import { getTicketDetail, replyTicket, updateTicket } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { toast, toastSuccess } from '@/components/Toast';
import { getSession } from '@/lib/api/auth-store';
import type { TicketDetail, TicketStatus } from '@/lib/api/endpoints';

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useT();
  const id = decodeURIComponent(params.id);

  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    const s = getSession();
    setRole(s?.role ?? null);
    getTicketDetail(id)
      .then((r) => { setDetail(r.ticket); setLoading(false); })
      .catch((e: unknown) => {
        setError(e);
        setLoading(false);
      });
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  function doReply() {
    if (!detail || !replyText.trim()) return;
    setBusy(true);
    replyTicket(detail.id, replyText.trim())
      .then(() => getTicketDetail(detail.id))
      .then((r) => { setDetail(r.ticket); setReplyText(''); toastSuccess(t.ticket.replySend + ' ✓'); })
      .catch((e: unknown) => {
        const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.common.networkErr);
        setError(msg);
        toast(msg, 'error');
      })
      .finally(() => setBusy(false));
  }

  function doUpdate(status: TicketStatus) {
    if (!detail) return;
    setBusy(true);
    updateTicket(detail.id, { status })
      .then(() => getTicketDetail(detail.id))
      .then((r) => setDetail(r.ticket))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : t.common.networkErr;
        setError(msg);
        toast(msg, 'error');
      })
      .finally(() => setBusy(false));
  }

  if (loading) {
    return (
      <PhoneShell>
        <TopBar title={t.ticket.detailTitle} />
        <main className="p-5"><PageLoading /></main>
      </PhoneShell>
    );
  }

  if (error || !detail) {
    return (
      <PhoneShell>
        <TopBar title={t.ticket.detailTitle} />
        <main className="p-4 space-y-3">
          <ErrorBlock
            error={error ?? '—'}
            onRetry={load}
            showLoginLink={error instanceof ApiError && error.status === 401}
            loginNext={`/tickets/${id}`}
          />
          <Link href="/tickets" className="btn-secondary block text-center">{t.ticket.backList}</Link>
        </main>
      </PhoneShell>
    );
  }

  const isAdmin = role === 'admin';
  const isUrgent = detail.severity === 'urgent' || detail.severity === 'high';

  return (
    <PhoneShell>
      <TopBar title={t.ticket.detailTitle} />
      <main className="flex-1 overflow-auto p-4 space-y-4">
        <div className={`card p-4 ${isUrgent ? 'urgent-border' : ''}`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h2 className="text-base font-bold">
              {isUrgent && <span aria-label="urgent" className="mr-1">🔴</span>}
              {detail.subject}
            </h2>
            <span className={`chip ${detail.status === 'resolved' || detail.status === 'closed' ? 'chip-green' : 'chip-orange'}`}>
              {t.ticket[`status_${detail.status}` as keyof typeof t.ticket] as string}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 space-y-0.5">
            <div>{t.ticket.type}:{t.ticket[`type_${detail.type}` as keyof typeof t.ticket] as string}</div>
            <div>{t.ticket.severityShortLabel}:{t.ticket[`sev_${detail.severity}` as keyof typeof t.ticket] as string}</div>
            <div>{t.ticket.author}:{detail.author?.displayName ?? '—'}{detail.author?.phone ? ` (${detail.author.phone})` : ''}</div>
            {detail.sku && <div>{t.ticket.device}:{detail.sku} {detail.serial ?? ''}</div>}
            <div>{t.ticket.createdAtLabel}:{new Date(detail.createdAt).toLocaleString()}</div>
          </div>
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap border-t dark:border-slate-700 pt-3">{detail.description}</p>
        </div>

        {/* 对话 */}
        <div>
          <h3 className="text-sm font-semibold mb-2">{t.ticket.conversation}</h3>
          <div className="space-y-2">
            {detail.messages.map((m) => (
              <div key={m.id} className={`text-sm rounded-lg p-3 ${
                m.senderRole === 'support' ? 'bg-matoo-light text-matoo-dark ml-4' :
                m.senderRole === 'system' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs italic' :
                'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 mr-4'
              }`}>
                <div className="text-[10px] text-slate-400 mb-1">
                  {m.senderRole === 'support' ? `🛠 ${detail.assignee?.displayName ?? 'Support'}` : m.senderRole === 'system' ? '⚙ System' : '👤 Customer'}
                  {' · '}
                  {new Date(m.createdAt).toLocaleString()}
                </div>
                <div className="whitespace-pre-wrap">{m.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 用户回复 */}
        <div className="card p-4">
          <label htmlFor="t-reply" className="label">{t.ticket.replyLabel}</label>
          <textarea id="t-reply" className="input min-h-[80px] py-2" placeholder={t.ticket.replyPlaceholder} value={replyText} onChange={(e) => setReplyText(e.target.value)} disabled={busy} maxLength={1000} />
          <button onClick={doReply} disabled={busy || !replyText.trim()} className="btn-primary mt-2 inline-flex items-center justify-center gap-2">
            {busy ? <Spinner size="sm" /> : null}
            {busy ? t.common.loading : t.ticket.replySend}
          </button>
        </div>

        {/* Admin 处理按钮 */}
        {isAdmin && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-2">{t.ticket.changeStatus}</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => doUpdate('in_progress')} disabled={busy} className="btn-secondary text-sm">{t.ticket.setInProgress}</button>
              <button onClick={() => doUpdate('waiting_customer')} disabled={busy} className="btn-secondary text-sm">{t.ticket.setWaiting}</button>
              <button onClick={() => doUpdate('resolved')} disabled={busy} className="btn-primary text-sm">{t.ticket.setResolved}</button>
              <button onClick={() => doUpdate('closed')} disabled={busy} className="btn-ghost text-sm">{t.ticket.setClosed}</button>
            </div>
          </div>
        )}
      </main>
    </PhoneShell>
  );
}

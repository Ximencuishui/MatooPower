'use client';
// P2-22:工单回复消息气泡滑入动画 — 仅新消息带 bubble-in,
// 历史气泡用 seenIds 记录避免重复触发动画
import { useEffect, useRef, useState } from 'react';
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
import { useAbortedFetch } from '@/hooks/useAbortedFetch';
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
  // P2-22:追踪已渲染过的消息 ID,新加入的消息才播 bubble-in,避免重复动画
  const seenIds = useRef<Set<string>>(new Set());
  // 首次入场批量延迟;之后只对新消息即时入场
  const [firstRender, setFirstRender] = useState(true);
  // P0 UX-10:onRetry 时递增 reloadKey 触发重新 fetch
  const [reloadKey, setReloadKey] = useState(0);
  const roleRef = useRef<string | null>(null);

  function load() {
    setError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  // 同步 role(仅一次)
  useEffect(() => {
    const s = getSession();
    roleRef.current = s?.role ?? null;
    setRole(s?.role ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // P0 UX-10:用 useAbortedFetch 取代裸 useEffect+load,组件卸载或 id/reload 变化时取消
  useAbortedFetch((signal) => {
    setLoading(true);
    setError(null);
    getTicketDetail(id, { signal })
      .then((r) => {
        setDetail(r.ticket);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
        setLoading(false);
      });
  }, [id, reloadKey]);

  // P0 UX-10:reply/update 也加 AbortController,组件卸载时取消未完成的请求
  const ctrlRef = useRef<AbortController | null>(null);
  useEffect(() => () => { ctrlRef.current?.abort(); }, []);

  // P2-22:首次渲染完成后,关闭"批量错落入场"模式,之后只对新增消息播 bubble-in
  useEffect(() => {
    if (detail && firstRender) {
      // 用 requestAnimationFrame 等当前帧所有消息都走完 seenIds 填充再切状态
      const raf = requestAnimationFrame(() => setFirstRender(false));
      return () => cancelAnimationFrame(raf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.messages.length]);

  function doReply() {
    if (!detail || !replyText.trim()) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setBusy(true);
    replyTicket(detail.id, replyText.trim(), { signal: ctrl.signal })
      .then(() => getTicketDetail(detail.id, { signal: ctrl.signal }))
      .then((r) => { if (!ctrl.signal.aborted) { setDetail(r.ticket); setReplyText(''); toastSuccess(t.ticket.replySend + ' ✓'); } })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.common.networkErr);
        setError(msg);
        toast(msg, 'error');
      })
      .finally(() => { if (!ctrl.signal.aborted) setBusy(false); });
  }

  function doUpdate(status: TicketStatus) {
    if (!detail) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setBusy(true);
    updateTicket(detail.id, { status }, { signal: ctrl.signal })
      .then(() => getTicketDetail(detail.id, { signal: ctrl.signal }))
      .then((r) => { if (!ctrl.signal.aborted) setDetail(r.ticket); })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        const msg = e instanceof Error ? e.message : t.common.networkErr;
        setError(msg);
        toast(msg, 'error');
      })
      .finally(() => { if (!ctrl.signal.aborted) setBusy(false); });
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
          {/* UX-22:admin 进入时,返回链接跳 /admin/tickets 而不是 /tickets */}
          <Link href={role === 'admin' ? '/admin/tickets' : '/tickets'} className="btn-secondary block text-center">{t.ticket.backList}</Link>
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
            {detail.messages.map((m, i) => {
              // P2-22:首次渲染所有气泡错落入场;后续只对新消息立即 bubble-in
              const isNew = !seenIds.current.has(m.id);
              if (isNew) seenIds.current.add(m.id);
              const animClass = firstRender
                ? `bubble-in`
                : isNew
                ? `bubble-in`
                : '';
              // 首屏错落延迟,前 15 条递增,避免老工单 50 条全播太久
              const delay = firstRender ? `${Math.min(i, 15) * 30}ms` : '0ms';
              return (
                <div
                  key={m.id}
                  style={animClass ? { animationDelay: delay } : undefined}
                  className={`text-sm rounded-lg p-3 will-change-transform ${animClass} ${
                    m.senderRole === 'support' ? 'bg-matoo-light text-matoo-dark ml-4' :
                    m.senderRole === 'system' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs italic' :
                    'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 mr-4'
                  }`}
                >
                  <div className="text-[10px] text-slate-400 mb-1">
                    {m.senderRole === 'support' ? (
                      <><span aria-hidden="true">🛠</span> {detail.assignee?.displayName ?? 'Support'}</>
                    ) : m.senderRole === 'system' ? (
                      <><span aria-hidden="true">⚙</span> System</>
                    ) : (
                      <><span aria-hidden="true">👤</span> Customer</>
                    )}
                    {' · '}
                    {new Date(m.createdAt).toLocaleString()}
                  </div>
                  <div className="whitespace-pre-wrap">{m.body}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 用户回复 */}
        <div className="card p-4">
          <label htmlFor="t-reply" className="label">{t.ticket.replyLabel}</label>
          <textarea id="t-reply" className="input min-h-[80px] py-2" placeholder={t.ticket.replyPlaceholder} value={replyText} onChange={(e) => setReplyText(e.target.value)} disabled={busy} maxLength={1000} dir="auto" />
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

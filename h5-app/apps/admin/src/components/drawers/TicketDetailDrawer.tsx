// Admin 工单详情 Drawer
// - 展示主题/正文/状态/严重程度 + 完整消息历史
// - 内置回复表单 + 状态切换（PUT /tickets/:id）
// - 提交后刷新详情 + 通知父组件
'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '@/components/Drawer';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';
import {
  getTicketDetail,
  replyTicket,
  updateTicket,
  getTicketAuditTrail,
  type TicketDetail,
  type TicketAuditTrailDto,
} from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';

type AuditTab = 'detail' | 'audit';

interface Props {
  ticketId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

type TicketStatusView = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed' | 'pending' | 'replied';
type TicketSeverityView = 'low' | 'medium' | 'high' | 'urgent' | 'normal';

const STATUS_LABEL: Record<TicketStatusView, string> = {
  open: '待处理',
  in_progress: '处理中',
  waiting_customer: '等待客户',
  resolved: '已解决',
  closed: '已关闭',
  pending: '待处理',
  replied: '已回复',
};

const SEVERITY_LABEL: Record<TicketSeverityView, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
  normal: '普通',
};

const STATUS_COLOR: Record<TicketStatusView, string> = {
  open: 'chip-blue',
  in_progress: 'chip-amber',
  waiting_customer: 'chip-violet',
  resolved: 'chip-emerald',
  closed: 'chip-slate',
  pending: 'chip-blue',
  replied: 'chip-emerald',
};

const SEVERITY_COLOR: Record<TicketSeverityView, string> = {
  low: 'chip-slate',
  medium: 'chip-blue',
  high: 'chip-amber',
  urgent: 'chip-rose',
  normal: 'chip-slate',
};

function statusLabel(s: string): string {
  return (STATUS_LABEL as Record<string, string>)[s] ?? s;
}
function statusColor(s: string): string {
  return (STATUS_COLOR as Record<string, string>)[s] ?? 'chip-slate';
}
function severityLabel(s: string): string {
  return (SEVERITY_LABEL as Record<string, string>)[s] ?? s;
}
function severityColor(s: string): string {
  return (SEVERITY_COLOR as Record<string, string>)[s] ?? 'chip-slate';
}

export function TicketDetailDrawer({ ticketId, open, onClose, onChanged }: Props) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  // #P2-1:审计 Tab
  const [tab, setTab] = useState<AuditTab>('detail');
  const [audit, setAudit] = useState<TicketAuditTrailDto | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<Error | null>(null);

  useEffect(() => {
    if (!open || !ticketId) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setTab('detail');
    setAudit(null);
    setAuditError(null);
    getTicketDetail(ticketId, ctrl.signal)
      .then((r) => setTicket(r.ticket))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          setError(new Error('未授权,请重新登录'));
        } else {
          setError(e as Error);
        }
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [open, ticketId]);

  // #P2-1:切换到审计 Tab 时按需拉取 audit trail(列表不展开时避免无谓请求)
  useEffect(() => {
    if (!open || !ticketId || tab !== 'audit' || audit) return;
    const ctrl = new AbortController();
    setAuditLoading(true);
    setAuditError(null);
    getTicketAuditTrail(ticketId, ctrl.signal)
      .then((r) => setAudit(r))
      .catch((e) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setAuditError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => setAuditLoading(false));
    return () => ctrl.abort();
  }, [tab, open, ticketId, audit]);

  async function handleReply() {
    if (!ticket || !reply.trim() || submitting) return;
    setSubmitting(true);
    try {
      await replyTicket(ticket.id, reply.trim());
      const fresh = await getTicketDetail(ticket.id);
      setTicket(fresh.ticket);
      setReply('');
      onChanged?.();
    } catch (e) {
      alert('回复失败: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(next: string) {
    if (!ticket || updating || ticket.status === next) return;
    setUpdating(true);
    try {
      await updateTicket(ticket.id, { status: next as any });
      const fresh = await getTicketDetail(ticket.id);
      setTicket(fresh.ticket);
      onChanged?.();
    } catch (e) {
      alert('更新失败: ' + (e as Error).message);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="工单详情"
      subtitle={ticket?.subject ?? ticketId ?? ''}
      width="lg"
    >
      {loading && <PageLoading />}
      {error && <ErrorBlock error={error} />}
      {ticket && !loading && !error && (
        <div className="space-y-6">
          {/* #P2-1:Tab 切换 — 详情 / 审计 */}
          <div className="flex items-center gap-1 border-b border-slate-200">
            {(
              [
                { key: 'detail' as AuditTab, label: '详情' },
                { key: 'audit' as AuditTab, label: '审计轨迹' },
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

          {tab === 'detail' && (
            <DetailTab
              ticket={ticket}
              reply={reply}
              setReply={setReply}
              submitting={submitting}
              updating={updating}
              onReply={handleReply}
              onStatusChange={handleStatusChange}
            />
          )}
          {tab === 'audit' && (
            <AuditTab
              audit={audit}
              loading={auditLoading}
              error={auditError}
              onRetry={() => {
                setAudit(null);
                setAuditError(null);
                setTab('detail');
                setTimeout(() => setTab('audit'), 0);
              }}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}

/* ============== 详情子组件(原内容迁入,行为不变) ============== */
function DetailTab({
  ticket,
  reply,
  setReply,
  submitting,
  updating,
  onReply,
  onStatusChange,
}: {
  ticket: TicketDetail;
  reply: string;
  setReply: (v: string) => void;
  submitting: boolean;
  updating: boolean;
  onReply: () => void;
  onStatusChange: (s: string) => void;
}) {
  return (
    <div className="space-y-6">
          {/* Meta */}
          <section className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500 mb-1">提交人</div>
              <div className="font-medium">
                {ticket.userDisplayName ?? ticket.userPhone ?? ticket.userId}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">创建时间</div>
              <div className="font-mono text-xs">{ticket.createdAt}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">状态</div>
              <span className={`chip ${statusColor(ticket.status)}`}>
                {statusLabel(ticket.status)}
              </span>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">严重程度</div>
              <span className={`chip ${severityColor(ticket.severity)}`}>
                {severityLabel(ticket.severity)}
              </span>
            </div>
            {ticket.category && (
              <div className="col-span-2">
                <div className="text-xs text-slate-500 mb-1">分类</div>
                <div className="font-medium">{ticket.category}</div>
              </div>
            )}
          </section>

          {/* Status actions */}
          <section>
            <div className="text-xs text-slate-500 mb-2">快速变更状态</div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(STATUS_LABEL).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onStatusChange(s)}
                  disabled={updating || ticket.status === s}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                    ticket.status === s
                      ? 'bg-matoo-light dark:bg-matoo/20 border-matoo text-matoo-dark dark:text-matoo-light font-semibold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  } disabled:opacity-50`}
                >
                  {statusLabel(s)}
                </button>
              ))}
            </div>
          </section>

          {/* Body */}
          <section>
            <div className="text-xs text-slate-500 mb-2">原始描述</div>
            <div className="card p-4 text-sm whitespace-pre-wrap">
              {ticket.body}
            </div>
          </section>

          {/* Messages */}
          <section>
            <div className="text-xs text-slate-500 mb-2">
              对话历史 · {ticket.messages.length} 条
            </div>
            <div className="space-y-3">
              {ticket.messages.length === 0 && (
                <div className="text-sm text-slate-400 italic">暂无回复</div>
              )}
              {ticket.messages.map((m) => (
                <div
                  key={m.id}
                  className={`card p-3 ${
                    m.userRole === 'admin' || m.userRole === 'support'
                      ? 'bg-matoo-light/40 dark:bg-matoo/10 border-matoo/30'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-sm font-medium">
                      {m.userDisplayName ?? m.userId}
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-500">
                        {m.userRole}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {m.createdAt}
                    </div>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Reply form */}
          <section>
            <div className="text-xs text-slate-500 mb-2">回复</div>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="输入回复内容..."
              rows={3}
              className="input w-full resize-y"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={onReply}
                disabled={!reply.trim() || submitting}
                className="btn-primary"
              >
                {submitting ? '发送中...' : '发送回复'}
              </button>
            </div>
          </section>
    </div>
  );
}

/* ============== 审计子组件 ============== */
function AuditTab({
  audit,
  loading,
  error,
  onRetry,
}: {
  audit: TicketAuditTrailDto | null;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  if (loading) return <PageLoading />;
  if (error) return <ErrorBlock error={error} onRetry={onRetry} />;
  if (!audit) return <div className="text-sm text-slate-400 italic">暂无数据</div>;
  const statusLogs = audit.statusLogs ?? [];
  const auditLogs = audit.audit ?? [];
  return (
    <div className="space-y-6">
      <section>
        <div className="text-xs text-slate-500 mb-2">
          状态变更轨迹 · {statusLogs.length} 条
        </div>
        {statusLogs.length === 0 ? (
          <div className="text-sm text-slate-400 italic">暂无状态变更</div>
        ) : (
          <div className="space-y-2">
            {statusLogs.map((l) => (
              <div key={l.id} className="card p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="chip chip-blue text-[10px]">{l.action}</span>
                    <span className="font-medium">
                      {l.fromStatus ?? '—'} → {l.toStatus ?? '—'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">{l.createdAt}</span>
                </div>
                <div className="text-[11px] text-slate-500 mb-1">
                  by {l.actorUserId ?? 'system'}{l.actorRole ? ` · ${l.actorRole}` : ''}
                </div>
                {l.notes && (
                  <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {l.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <div className="text-xs text-slate-500 mb-2">
          资源审计 · {auditLogs.length} 条
        </div>
        {auditLogs.length === 0 ? (
          <div className="text-sm text-slate-400 italic">暂无资源审计</div>
        ) : (
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div key={log.id} className="card p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{log.action}</span>
                  <span className="text-[11px] font-mono text-slate-500">{log.createdAt}</span>
                </div>
                <div className="text-[11px] text-slate-500 mb-1">
                  by {log.actorUserId ?? 'system'}{log.actorRole ? ` · ${log.actorRole}` : ''}
                </div>
                {log.payload && (
                  <details className="text-[11px] text-slate-600">
                    <summary className="cursor-pointer hover:text-matoo-dark">payload</summary>
                    <pre className="mt-1 p-2 bg-slate-50 dark:bg-slate-900 rounded overflow-x-auto whitespace-pre-wrap break-all">
                      {log.payload}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
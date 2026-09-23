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
  type TicketDetail,
} from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';

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

  useEffect(() => {
    if (!open || !ticketId) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
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
                  onClick={() => handleStatusChange(s)}
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
                onClick={handleReply}
                disabled={!reply.trim() || submitting}
                className="btn-primary"
              >
                {submitting ? '发送中...' : '发送回复'}
              </button>
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}
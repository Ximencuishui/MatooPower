'use client';
// 消息中心:工单回复 + 系统通知的统一聚合页
// 数据来源:服务端暂无 /messages 端点,演示期聚合"我的工单"+ 后端 admin overview alerts
// 已读/未读:本地用 matoo.messages.lastSeen 时间戳对比实现(生产期由后端 per-user readAt 字段提供)
// P2-22:列表卡片滑入动画,索引错落延迟

import { useEffect, useRef, useMemo, useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TabBar } from '@/components/TabBar';
import { LangSwitch } from '@/components/LangSwitch';
import { PageLoading } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { useT } from '@/lib/i18n';
import { listMyTickets, getAdminOverview } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { getSession } from '@/lib/api/auth-store';
import { useAbortedFetch } from '@/hooks/useAbortedFetch';
import type { TicketItem, AdminOverviewDto } from '@/lib/api/endpoints';

type MsgItem =
  | { kind: 'ticket'; ts: string; data: TicketItem }
  | { kind: 'system'; ts: string; data: { title: string; hint: string; tone: 'warn' | 'info' } };

type Tab = 'all' | 'ticket' | 'system';

const LAST_SEEN_KEY = 'matoo.messages.lastSeen';

function getLastSeen(): string {
  if (typeof window === 'undefined') return new Date(0).toISOString();
  return window.localStorage.getItem(LAST_SEEN_KEY) ?? new Date(0).toISOString();
}

function setLastSeenNow() {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  }
}

export default function MessagesPage() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<MsgItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [role, setRole] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<string>(() => new Date(0).toISOString());
  // P0 UX-10:onRetry 时递增 reloadKey 触发重新 fetch
  const [reloadKey, setReloadKey] = useState(0);
  const sessionRef = useRef<ReturnType<typeof getSession>>(null);

  function load() {
    setError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  // 首次读取 session
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = getSession();
    sessionRef.current = s;
    setRole(s?.role ?? null);
    setLastSeen(getLastSeen());
  }, []);

  // P0 UX-10:用 useAbortedFetch 取代裸 useEffect+load,组件卸载或 reload 时取消
  useAbortedFetch((signal) => {
    setLoading(true);
    setError(null);
    const s = sessionRef.current ?? getSession();
    if (!s?.token) {
      setLoading(false);
      return;
    }
    const ticketP = listMyTickets(undefined, { signal })
      .then((r) => r.items.map<MsgItem>((tk) => ({ kind: 'ticket', ts: tk.lastMessageAt ?? tk.updatedAt ?? tk.createdAt, data: tk })))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') throw e;
        return [] as MsgItem[];
      });
    const sysP =
      s.role === 'admin'
        ? getAdminOverview(undefined, { signal })
            .then((r: AdminOverviewDto) => buildSystemAlerts(r))
            .catch((e: unknown) => {
              if ((e as { name?: string })?.name === 'AbortError') throw e;
              return [] as MsgItem[];
            })
        : Promise.resolve([] as MsgItem[]);

    Promise.all([ticketP, sysP])
      .then(([tk, sys]) => {
        setItems([...tk, ...sys].sort((a, b) => (a.ts < b.ts ? 1 : -1)));
        setLoading(false);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
        setLoading(false);
      });
  }, [reloadKey]);

  function markAllRead() {
    setLastSeenNow();
    setLastSeen(new Date().toISOString());
  }

  const filtered = useMemo(() => {
    let list = tab === 'all' ? items : items.filter((m) => m.kind === tab);
    return list;
  }, [items, tab]);

  const unreadCount = useMemo(() => items.filter((m) => m.ts > lastSeen).length, [items, lastSeen]);

  return (
    <PhoneShell>
      <header className="topbar">
        <div className="flex items-center gap-2">
          <h1 className="text-[15px] font-semibold">{t.messages.title}</h1>
          {unreadCount > 0 && (
            <span aria-label={`unread ${unreadCount}`} className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-[11px] text-matoo underline">全部已读</button>
          )}
          <LangSwitch />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 space-y-3">
        {!getSession()?.token && !loading && (
          <EmptyState
            icon="🔔"
            title={t.messages.empty}
            hint={t.messages.emptyHint}
            ctaLabel={t.messages.goLogin}
            ctaHref={`/auth?next=${encodeURIComponent('/messages')}`}
          />
        )}

        {error != null && <ErrorBlock error={error} onRetry={load} showLoginLink={error instanceof ApiError && error.status === 401} loginNext="/messages" />}

        {!error && loading && <PageLoading />}

        {!error && !loading && getSession()?.token && (
          <>
            <div role="tablist" className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
              {([
                { k: 'all' as Tab, l: `${t.messages.tabs.all}${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
                { k: 'ticket' as Tab, l: t.messages.tabs.ticket },
                { k: 'system' as Tab, l: t.messages.tabs.system },
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

            {filtered.length === 0 && <EmptyState icon="🔕" title={t.messages.empty} hint={t.messages.emptyHint} />}

            <div className="space-y-2">
              {filtered.map((m, i) => {
                const isUnread = m.ts > lastSeen;
                // P2-22:错落延迟,单条最大 35ms 让最先的卡片不延迟过久;前 12 条以内递增
                const delay = `${Math.min(i, 12) * 35}ms`;
                if (m.kind === 'ticket') {
                  const tk = m.data;
                  return (
                    <Link
                      key={`tk-${tk.id}-${i}`}
                      href={`/tickets/${tk.id}`}
                      style={{ animationDelay: delay }}
                      className={`card p-3 block slide-in-right will-change-transform ${tk.severity === 'urgent' || tk.severity === 'high' ? 'urgent-border' : ''} ${isUnread ? 'ring-1 ring-matoo/30' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <div aria-hidden="true" className="text-base mt-0.5">{isUnread ? '🔵' : '🎫'}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate flex items-center gap-2">
                            {tk.subject}
                            {isUnread && <span className="text-[9px] text-matoo font-bold uppercase">NEW</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {t.messages.tabs.ticket} · {tk.messageCount} 💬 · {new Date(m.ts).toLocaleString()}
                          </div>
                        </div>
                        <span className={`chip text-[10px] ${
                          tk.status === 'resolved' || tk.status === 'closed' ? 'chip-green' :
                          tk.severity === 'urgent' || tk.severity === 'high' ? 'chip-red' :
                          'chip-orange'
                        }`}>{tk.status}</span>
                      </div>
                    </Link>
                  );
                }
                return (
                  <div
                    key={`sys-${i}`}
                    style={{ animationDelay: delay }}
                    className={`card p-3 slide-in-right will-change-transform ${m.data.tone === 'warn' ? 'urgent-border' : ''} ${isUnread ? 'ring-1 ring-matoo/30' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <div aria-hidden="true" className="text-base mt-0.5">{m.data.tone === 'warn' ? '⚠' : 'ℹ'}</div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold flex items-center gap-2">
                          {m.data.title}
                          {isUnread && <span className="text-[9px] text-matoo font-bold uppercase">NEW</span>}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{m.data.hint}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {unreadCount === 0 && filtered.length > 0 && (
              <div className="text-center text-[11px] text-slate-400 dark:text-slate-500 py-4">✓ 全部已读</div>
            )}
          </>
        )}
      </main>

      <TabBar />
    </PhoneShell>
  );
}

function buildSystemAlerts(r: AdminOverviewDto): MsgItem[] {
  const out: MsgItem[] = [];
  if (r.overview.ticket.urgent > 0) {
    out.push({
      kind: 'system',
      ts: new Date().toISOString(),
      data: {
        title: `紧急工单 ${r.overview.ticket.urgent} 条待处理`,
        hint: '请尽快在客服工作台处理。',
        tone: 'warn',
      },
    });
  }
  if (r.overview.warranty.active > 0) {
    out.push({
      kind: 'system',
      ts: new Date().toISOString(),
      data: {
        title: `有效保修 ${r.overview.warranty.active} 条`,
        hint: `本月新增 ${r.overview.warranty.activeThisMonth} 条。`,
        tone: 'info',
      },
    });
  }
  return out;
}
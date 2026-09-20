'use client';
// 消息中心 P1-8:工单回复 + 系统通知的统一聚合页
// 数据来源:服务端暂无 /messages 端点,演示期聚合"我的工单"+ 后端 admin overview alerts

import { useEffect, useState } from 'react';
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
import type { TicketItem, AdminOverviewDto } from '@/lib/api/endpoints';

type MsgItem =
  | { kind: 'ticket'; ts: string; data: TicketItem }
  | { kind: 'system'; ts: string; data: { title: string; hint: string; tone: 'warn' | 'info' } };

type Tab = 'all' | 'ticket' | 'system';

export default function MessagesPage() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<MsgItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [role, setRole] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    const s = getSession();
    setRole(s?.role ?? null);
    if (!s?.token) {
      setLoading(false);
      return;
    }
    const ticketP = listMyTickets()
      .then((r) => r.items.map<MsgItem>((tk) => ({ kind: 'ticket', ts: tk.lastMessageAt ?? tk.updatedAt ?? tk.createdAt, data: tk })))
      .catch(() => [] as MsgItem[]);
    const sysP =
      s.role === 'admin'
        ? getAdminOverview()
            .then((r: AdminOverviewDto) => buildSystemAlerts(r))
            .catch(() => [] as MsgItem[])
        : Promise.resolve([] as MsgItem[]);

    Promise.all([ticketP, sysP])
      .then(([tk, sys]) => {
        setItems([...tk, ...sys].sort((a, b) => (a.ts < b.ts ? 1 : -1)));
        setLoading(false);
      })
      .catch((e) => {
        setError(e);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = items.filter((m) => tab === 'all' || m.kind === tab);

  return (
    <PhoneShell>
      <header className="topbar">
        <h1 className="text-[15px] font-semibold">{t.messages.title}</h1>
        <LangSwitch />
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
                { k: 'all' as Tab, l: t.messages.tabs.all },
                { k: 'ticket' as Tab, l: t.messages.tabs.ticket },
                { k: 'system' as Tab, l: t.messages.tabs.system },
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

            {filtered.length === 0 && <EmptyState icon="🔕" title={t.messages.empty} hint={t.messages.emptyHint} />}

            <div className="space-y-2">
              {filtered.map((m, i) => {
                if (m.kind === 'ticket') {
                  const tk = m.data;
                  return (
                    <Link key={`tk-${tk.id}-${i}`} href={`/tickets/${tk.id}`} className={`card p-3 block ${tk.severity === 'urgent' || tk.severity === 'high' ? 'urgent-border' : ''}`}>
                      <div className="flex items-start gap-2">
                        <div aria-hidden="true" className="text-base mt-0.5">🎫</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{tk.subject}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
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
                  <div key={`sys-${i}`} className={`card p-3 ${m.data.tone === 'warn' ? 'urgent-border' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div aria-hidden="true" className="text-base mt-0.5">{m.data.tone === 'warn' ? '⚠' : 'ℹ'}</div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{m.data.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{m.data.hint}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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

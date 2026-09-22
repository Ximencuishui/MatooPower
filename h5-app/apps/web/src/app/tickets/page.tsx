'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TabBar } from '@/components/TabBar';
import { PageLoading } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { useT } from '@/lib/i18n';
import { listMyTickets } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { useAbortedFetch } from '@/hooks/useAbortedFetch';
import type { TicketItem, TicketStatus } from '@/lib/api/endpoints';

const TABS: Array<{ key: TicketStatus | 'all'; filter?: TicketStatus }> = [
  { key: 'all' },
  { key: 'open', filter: 'open' },
  { key: 'in_progress', filter: 'in_progress' },
  { key: 'resolved', filter: 'resolved' },
];

// P1-10:紧急工单置顶
const URGENT: TicketStatus | null = null;
const SEVERITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export default function MyTicketsPage() {
  const { t } = useT();
  const [tab, setTab] = useState<TicketStatus | 'all'>('all');
  const [items, setItems] = useState<TicketItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  // P0 UX-10:onRetry 时递增 reloadKey 触发重新 fetch
  const [reloadKey, setReloadKey] = useState(0);

  function load() {
    setError(null);
    setReloadKey((k) => k + 1);
  }

  // P0 UX-10:用 useAbortedFetch 取代裸 useEffect+load,组件卸载或 tab 切换/reload 时取消
  useAbortedFetch((signal) => {
    setError(null);
    const filter = TABS.find((tb) => tb.key === tab)?.filter;
    listMyTickets(filter, { signal })
      .then((r) => setItems(r.items))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
  }, [tab, reloadKey]);

  // 紧急置顶
  const sorted = useMemo(() => {
    if (!items) return null;
    return [...items].sort((a, b) => {
      const ra = SEVERITY_RANK[a.severity] ?? 9;
      const rb = SEVERITY_RANK[b.severity] ?? 9;
      if (ra !== rb) return ra - rb;
      return a.updatedAt < b.updatedAt ? 1 : -1;
    });
  }, [items]);

  return (
    <PhoneShell>
      <header className="topbar">
        <h1 className="text-[15px] font-semibold">{t.ticket.mineTitle}</h1>
        <Link href="/tickets/new" className="text-matoo text-sm font-medium">{t.ticket.newTitle} ›</Link>
      </header>

      <main className="flex-1 overflow-auto p-4 space-y-3">
        <div role="tablist" className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              role="tab"
              aria-selected={tab === tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex-1 py-2 rounded-lg ${tab === tb.key ? 'bg-white dark:bg-slate-800 shadow-sm font-semibold' : 'text-slate-500'}`}
            >
              {t.ticket[`tab_${tb.key}` as keyof typeof t.ticket] as string}
            </button>
          ))}
        </div>

        {error != null && <ErrorBlock error={error} onRetry={load} showLoginLink={error instanceof ApiError && error.status === 401} loginNext="/tickets" />}

        {!error && items === null && <PageLoading />}

        {!error && items && items.length === 0 && (
          <EmptyState
            icon="🎫"
            title={t.ticket.empty}
            ctaLabel={t.ticket.newTitle}
            ctaHref="/tickets/new"
          />
        )}

        {!error && sorted && sorted.map((tk) => {
          const isUrgent = tk.severity === 'urgent' || tk.severity === 'high';
          return (
            <Link
              key={tk.id}
              href={`/tickets/${tk.id}`}
              className={`card p-3 block ${isUrgent ? 'urgent-border' : ''}`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {isUrgent && <span aria-label="urgent" className="mr-1">🔴</span>}
                    {tk.subject}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {tk.sku ? `${tk.sku} · ${tk.serial}` : t.ticket.noSubjectDevice}
                    {' · '}
                    {new Date(tk.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`chip text-[10px] ${
                    tk.status === 'resolved' || tk.status === 'closed' ? 'chip-green' :
                    isUrgent ? 'chip-red' :
                    'chip-orange'
                  }`}>{t.ticket[`status_${tk.status}` as keyof typeof t.ticket] as string}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{tk.messageCount} 💬</span>
                </div>
              </div>
            </Link>
          );
        })}
      </main>

      <TabBar />
    </PhoneShell>
  );
}
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TabBar } from '@/components/TabBar';
import { useT } from '@/lib/i18n';
import { listMyTickets } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import type { TicketItem, TicketStatus } from '@/lib/api/endpoints';

const TABS: Array<{ key: TicketStatus | 'all'; filter?: TicketStatus }> = [
  { key: 'all' },
  { key: 'open', filter: 'open' },
  { key: 'in_progress', filter: 'in_progress' },
  { key: 'resolved', filter: 'resolved' },
];

export default function MyTicketsPage() {
  const { t } = useT();
  const [tab, setTab] = useState<TicketStatus | 'all'>('all');
  const [items, setItems] = useState<TicketItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const filter = TABS.find((tb) => tb.key === tab)?.filter;
    listMyTickets(filter)
      .then((r) => setItems(r.items))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          setError(t.ticket.needLogin);
        } else {
          setError(e instanceof Error ? e.message : t.common.networkErr);
        }
      });
  }, [tab, t.common.networkErr, t.ticket.needLogin]);

  return (
    <PhoneShell>
      <header className="topbar">
        <h1 className="text-[15px] font-semibold">{t.ticket.mineTitle}</h1>
        <Link href="/tickets/new" className="text-matoo text-sm font-medium">{t.ticket.newTitle} ›</Link>
      </header>

      <main className="flex-1 overflow-auto p-4 space-y-3">
        <div role="tablist" className="flex bg-slate-100 p-1 rounded-xl text-xs">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              role="tab"
              aria-selected={tab === tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex-1 py-2 rounded-lg ${tab === tb.key ? 'bg-white shadow-sm font-semibold' : 'text-slate-500'}`}
            >
              {t.ticket[`tab_${tb.key}` as keyof typeof t.ticket] as string}
            </button>
          ))}
        </div>

        {error && (
          <div role="alert" className="card p-4 text-sm text-red-600 bg-red-50">
            {error}
            <Link href="/auth?next=/tickets" className="block mt-2 text-matoo underline">{t.devices.goLogin}</Link>
          </div>
        )}

        {!error && items === null && (
          <div className="text-center text-slate-400 text-sm py-8">{t.scan.loadingHint}</div>
        )}

        {!error && items && items.length === 0 && (
          <div className="card p-8 text-center text-slate-500 text-sm">{t.ticket.empty}</div>
        )}

        {!error && items && items.map((tk) => (
          <Link key={tk.id} href={`/tickets/${tk.id}`} className="card p-3 block">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{tk.subject}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {tk.sku ? `${tk.sku} · ${tk.serial}` : t.ticket.noSubjectDevice}
                  {' · '}
                  {new Date(tk.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`chip text-[10px] ${
                  tk.status === 'resolved' || tk.status === 'closed' ? 'chip-green' :
                  tk.severity === 'urgent' || tk.severity === 'high' ? 'chip-red' :
                  'chip-orange'
                }`}>{t.ticket[`status_${tk.status}` as keyof typeof t.ticket] as string}</span>
                <span className="text-[10px] text-slate-400">{tk.messageCount} 💬</span>
              </div>
            </div>
          </Link>
        ))}
      </main>

      <TabBar />
    </PhoneShell>
  );
}
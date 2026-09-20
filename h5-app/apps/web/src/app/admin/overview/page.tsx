'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { LangSwitch } from '@/components/LangSwitch';
import { useT } from '@/lib/i18n';
import { getAdminOverview } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import type { AdminOverviewDto } from '@/lib/api/endpoints';

export default function AdminOverviewPage() {
  const { t } = useT();
  const [overview, setOverview] = useState<AdminOverviewDto['overview'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminOverview()
      .then((r) => setOverview(r.overview))
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.common.networkErr)));
  }, [t.common.networkErr]);

  if (error) {
    return (
      <PhoneShell>
        <TopBar title={t.adminOverview.title} right={<LangSwitch />} />
        <main className="p-5">
          <div role="alert" className="card p-4 text-sm text-red-600 bg-red-50">{error}</div>
        </main>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <TopBar title={t.adminOverview.title} right={<LangSwitch />} />
      <main className="flex-1 overflow-auto p-4 space-y-4">
        {/* 主 KPI */}
        {overview && (
          <>
            <section className="grid grid-cols-2 gap-3">
              <Kpi label={t.adminOverview.skuTotal} value={overview.sku.total} sub={t.adminOverview.skuActivated.replace('{n}', String(overview.sku.activated))} />
              <Kpi label={t.adminOverview.userTotal} value={overview.user.total} sub={t.adminOverview.userDealer.replace('{n}', String(overview.user.dealer))} />
              <Kpi label={t.adminOverview.warrantyActive} value={overview.warranty.active} sub={t.adminOverview.warrantyThisMonth.replace('{n}', String(overview.warranty.activeThisMonth))} highlight />
              <Kpi label={t.adminOverview.deviceTotal} value={overview.device.total} sub={t.adminOverview.deviceThisMonth.replace('{n}', String(overview.device.boundThisMonth))} />
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2">{t.adminOverview.ticketsTitle}</h3>
              <div className="card p-3 grid grid-cols-3 gap-3 text-center">
                <Stat label={t.adminOverview.ticketsOpen} value={overview.ticket.open} warn={overview.ticket.open > 0} />
                <Stat label={t.adminOverview.ticketsUrgent} value={overview.ticket.urgent} warn={overview.ticket.urgent > 0} />
                <Stat label={t.adminOverview.ticketsNew} value={overview.ticket.newThisMonth} />
              </div>
              <Link href="/admin/tickets" className="btn-secondary mt-3 block text-center">{t.adminOverview.viewTickets} ›</Link>
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2">{t.adminOverview.quickLinks}</h3>
              <div className="grid grid-cols-2 gap-3">
                <QuickLink href="/admin/tickets" emoji="🎫" label={t.ticket.adminTitle} />
                <QuickLink href="/dealer/dashboard" emoji="🛒" label={t.dealer.title} />
                <QuickLink href="/devices" emoji="📱" label={t.tabs.devices} />
                <QuickLink href="/scan" emoji="📷" label={t.scanEntry.title} />
              </div>
            </section>
          </>
        )}
        {!overview && (
          <div className="text-center text-slate-400 text-sm py-8">{t.scan.loadingHint}</div>
        )}
      </main>
    </PhoneShell>
  );
}

function Kpi({ label, value, sub, highlight }: { label: string; value: number; sub?: string; highlight?: boolean }) {
  return (
    <div className={`card p-3 ${highlight ? 'bg-matoo-light' : ''}`}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${highlight ? 'text-matoo-dark' : 'text-slate-900'}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${warn ? 'text-amber-600' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}

function QuickLink({ href, emoji, label }: { href: string; emoji: string; label: string }) {
  return (
    <Link href={href} className="card p-4 flex items-center gap-3">
      <span aria-hidden="true" className="text-2xl">{emoji}</span>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-slate-400 ml-auto" aria-hidden="true">›</span>
    </Link>
  );
}
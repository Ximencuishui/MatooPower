'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { PageLoading } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { useT } from '@/lib/i18n';
import { getDealerOverview, listDealerWarranties, downloadDealerWarrantiesCsv, downloadDealerDevicesCsv } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { getSession } from '@/lib/api/auth-store';
import type { DealerOverviewDto, DealerWarrantyItem } from '@/lib/api/endpoints';

import { useRequireRole, RoleGuardView } from '@/hooks/useRequireRole';
import { useAbortedFetch } from '@/hooks/useAbortedFetch';

export default function DealerDashboardPage() {
  const { t } = useT();
  const guard = useRequireRole(['dealer', 'admin']);
  const [overview, setOverview] = useState<DealerOverviewDto['overview'] | null>(null);
  const [warranties, setWarranties] = useState<DealerWarrantyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [role, setRole] = useState<string | null>(null);
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  // P0 UX-10:onRetry 时递增 reloadKey 触发重新 fetch
  const [reloadKey, setReloadKey] = useState(0);

  function load() {
    setError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  // 同步 session/role 一次(供 useAbortedFetch 内部读)
  function syncSession() {
    if (typeof window === 'undefined') return;
    const s = getSession();
    setSession(s);
    setRole(s?.role ?? null);
  }

  // P0 UX-10:用 useAbortedFetch 取代裸 useEffect+load,组件卸载或 reload 时取消
  useAbortedFetch((signal) => {
    if (guard.status !== 'ok') return;
    syncSession();
    setLoading(true);
    setError(null);
    Promise.all([getDealerOverview({ signal }), listDealerWarranties(undefined, { signal })])
      .then(([ov, ws]) => {
        setOverview(ov.overview);
        setWarranties(ws.items);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
        setLoading(false);
      });
  }, [guard.status, reloadKey]);

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title={t.dealer.title} />;
  }

  return (
    <PhoneShell>
      <TopBar
        title={t.dealer.title}
        right={
          <ExportCsvButton
            filename={`dealer-warranties-${new Date().toISOString().slice(0, 10)}`}
            fetch={() => downloadDealerWarrantiesCsv()}
            count={warranties.length}
          />
        }
      />
      <main className="flex-1 overflow-auto pb-6">
        <div className="p-4">
          <div className="card p-3 bg-gradient-to-br from-matoo-light to-white dark:from-matoo/20 dark:to-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-matoo text-white flex items-center justify-center font-bold">
              {(session?.displayName ?? 'D').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{session?.displayName ?? 'Dealer'}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{role ?? '—'} · {t.dealer.verified}</div>
            </div>
            <Link href="/dealer/batch" className="text-matoo text-sm font-medium">{t.dealer.addMore} ›</Link>
          </div>
        </div>

        {error != null && (
          <div className="mx-4">
            <ErrorBlock
              error={error}
              onRetry={load}
              showLoginLink={error instanceof ApiError && (error.status === 401 || error.status === 403)}
              loginNext="/dealer/dashboard"
            />
          </div>
        )}

        {!error && loading && <PageLoading />}

        {!error && !loading && overview && (
          <>
            <section className="px-4">
              <h3 className="font-semibold mb-2">{t.dealer.overview}</h3>
              <div className="grid grid-cols-2 gap-3">
                <Stat label={t.dealer.statWarranty} value={overview.warrantyCount} />
                <Stat label={t.dealer.statDevice} value={overview.deviceCount} />
                <Stat label={t.dealer.statPending} value={overview.pendingReviewCount} />
                <Stat label={t.dealer.statThisMonth} value={overview.activatedThisMonth} highlight />
              </div>
            </section>

            <section className="px-4 mt-4">
              <h3 className="font-semibold mb-2">快捷操作</h3>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/dealer/batch" className="card p-3 flex items-center gap-2">
                  <span aria-hidden="true" className="text-xl">📦</span>
                  <span className="text-sm font-medium">批量激活</span>
                </Link>
                <Link href="/dealer/pickup" className="card p-3 flex items-center gap-2">
                  <span aria-hidden="true" className="text-xl">🚚</span>
                  <span className="text-sm font-medium">提货登记</span>
                </Link>
              </div>
            </section>

            <section className="px-4 mt-4">
              <h3 className="font-semibold mb-2">{t.dealer.recentWarranties}</h3>
              {warranties.length === 0 && (
                <EmptyState icon="🛡" title={t.dealer.emptyRecent} ctaLabel={t.dealer.addMore} ctaHref="/dealer/batch" />
              )}
              <div className="space-y-2">
                {warranties.slice(0, 10).map((w) => (
                  <div key={w.id} className="card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" title={w.s_modelName ?? w.skuId}>{w.s_modelName ?? w.skuId}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{w.s_serial ?? w.skuId}</div>
                      </div>
                      <span className={`chip ${w.status === 'active' ? 'chip-green' : 'chip-orange'}`}>
                        {w.status === 'active' ? t.warranty.statusActive : t.warranty.statusPending}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between">
                      <span>{t.dealer.invoiceNo}:{w.invoiceNo ?? '—'}</span>
                      <span>{t.warranty.endAt}:{w.endAtWhole.slice(0, 10)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </PhoneShell>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`card p-4 ${highlight ? 'bg-matoo-light' : ''}`}>
      <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${highlight ? 'text-matoo-dark' : 'text-slate-900 dark:text-slate-100'}`}>{value}</div>
    </div>
  );
}
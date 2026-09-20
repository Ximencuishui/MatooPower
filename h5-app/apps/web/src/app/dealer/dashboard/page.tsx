'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { useT } from '@/lib/i18n';
import { getDealerOverview, listDealerWarranties } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { getSession } from '@/lib/api/auth-store';
import type { DealerOverviewDto, DealerWarrantyItem } from '@/lib/api/endpoints';

export default function DealerDashboardPage() {
  const { t } = useT();
  const [overview, setOverview] = useState<DealerOverviewDto['overview'] | null>(null);
  const [warranties, setWarranties] = useState<DealerWarrantyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s?.token) {
      setError(t.dealer.needLogin);
      setLoading(false);
      return;
    }
    setRole(s.role);

    Promise.all([getDealerOverview(), listDealerWarranties()])
      .then(([ov, ws]) => {
        setOverview(ov.overview);
        setWarranties(ws.items);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 403) {
          setError(t.dealer.needLogin);
        } else if (e instanceof ApiError && e.status === 401) {
          setError(t.dealer.needLogin);
        } else {
          setError(e instanceof Error ? e.message : t.common.networkErr);
        }
        setLoading(false);
      });
  }, [t.common.networkErr, t.dealer.needLogin]);

  return (
    <PhoneShell>
      <TopBar title={t.dealer.title} />
      <main className="flex-1 overflow-auto pb-6">
        {/* 经销商身份卡 */}
        <div className="p-4">
          <div className="card p-3 bg-gradient-to-br from-matoo-light to-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-matoo text-white flex items-center justify-center font-bold">D</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Dhaka Power Hub</div>
              <div className="text-[11px] text-slate-500">{role ?? '—'} · {t.dealer.verified}</div>
            </div>
            <Link href="/dealer/batch" className="text-matoo text-sm font-medium">{t.dealer.addMore} ›</Link>
          </div>
        </div>

        {error && (
          <div className="mx-4">
            <div role="alert" className="card p-4 text-sm text-red-600 bg-red-50">{error}</div>
            <Link href="/auth?next=/dealer/dashboard" className="btn-primary mt-3 block text-center">{t.devices.goLogin}</Link>
          </div>
        )}

        {!error && loading && (
          <div className="text-center text-slate-400 text-sm py-8">{t.scan.loadingHint}</div>
        )}

        {!error && !loading && overview && (
          <>
            {/* 概览卡片 */}
            <section className="px-4">
              <h3 className="font-semibold mb-2">{t.dealer.overview}</h3>
              <div className="grid grid-cols-2 gap-3">
                <Stat label={t.dealer.statWarranty} value={overview.warrantyCount} />
                <Stat label={t.dealer.statDevice} value={overview.deviceCount} />
                <Stat label={t.dealer.statPending} value={overview.pendingReviewCount} />
                <Stat label={t.dealer.statThisMonth} value={overview.activatedThisMonth} highlight />
              </div>
            </section>

            {/* 最近保修记录 */}
            <section className="px-4 mt-4">
              <h3 className="font-semibold mb-2">{t.dealer.recentWarranties}</h3>
              {warranties.length === 0 && (
                <div className="card p-6 text-center text-slate-500 text-sm">{t.dealer.emptyRecent}</div>
              )}
              <div className="space-y-2">
                {warranties.slice(0, 10).map((w) => (
                  <div key={w.id} className="card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{w.s_modelName ?? w.skuId}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{w.s_serial ?? w.skuId}</div>
                      </div>
                      <span className={`chip ${w.status === 'active' ? 'chip-green' : 'chip-orange'}`}>
                        {w.status === 'active' ? t.warranty.statusActive : t.warranty.statusPending}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
                      <span>{t.dealer.invoiceNo}：{w.invoiceNo ?? '—'}</span>
                      <span>{t.warranty.endAt}：{w.endAtWhole.slice(0, 10)}</span>
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
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${highlight ? 'text-matoo-dark' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}
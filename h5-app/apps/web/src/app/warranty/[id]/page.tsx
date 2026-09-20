'use client';
// P0-1:电子保修卡 — 走 /warranty/by-sku/:skuId API,不再用 mock
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { PageLoading } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { useT } from '@/lib/i18n';
import { getWarrantyBySku } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { getSession } from '@/lib/api/auth-store';

type WarrantyDto = {
  id: string;
  skuId: string;
  status: 'active' | 'pending' | 'expired' | 'rejected';
  policy: 'INVOICE' | 'MFG_FALLBACK';
  startAt: string;
  endAtWhole: string;
  endAtCell?: string | null;
  endAtBms?: string | null;
  endAtParts?: string | null;
  country: string;
  city: string;
  dealerName: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  invoiceAmount: number | null;
  reviewNotes: string | null;
  createdAt: string;
  sku?: {
    id: string;
    sku: string;
    serial: string;
    modelName: string;
    capacity: string;
    voltage: string;
  };
};

export default function WarrantyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useT();
  const id = decodeURIComponent(params.id);

  const [w, setW] = useState<WarrantyDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  function load() {
    setLoading(true);
    setError(null);
    // 不调 API 时(未登录)直接走"去激活"页
    if (!getSession()?.token) {
      setLoading(false);
      return;
    }
    getWarrantyBySku(id)
      .then((r) => {
        setW((r.warranty ?? null) as WarrantyDto | null);
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
  }, [id]);

  if (loading) {
    return (
      <PhoneShell>
        <TopBar title={t.warranty.card} />
        <main className="p-5"><PageLoading /></main>
      </PhoneShell>
    );
  }

  if (!getSession()?.token) {
    return (
      <PhoneShell>
        <TopBar title={t.warranty.card} />
        <main className="p-4 space-y-3">
          <EmptyState
            icon="🛡"
            title={t.common.loginRequired}
            hint={t.common.loginRequiredHint}
            ctaLabel={t.common.goLogin}
            ctaHref={`/auth?next=${encodeURIComponent(`/warranty/${id}`)}`}
          />
        </main>
      </PhoneShell>
    );
  }

  if (error) {
    return (
      <PhoneShell>
        <TopBar title={t.warranty.card} />
        <main className="p-4 space-y-3">
          <ErrorBlock
            error={error}
            onRetry={load}
            showLoginLink={error instanceof ApiError && error.status === 401}
            loginNext={`/warranty/${id}`}
          />
        </main>
      </PhoneShell>
    );
  }

  if (!w) {
    return (
      <PhoneShell>
        <TopBar title={t.warranty.card} />
        <main className="p-4 space-y-3">
          <EmptyState
            icon="📋"
            title={t.warranty.detail}
            hint="该 SKU 尚未激活保修"
            ctaLabel={t.scan.activate}
            ctaHref={`/activate/${id}`}
          />
        </main>
      </PhoneShell>
    );
  }

  const sku = w.sku;
  const modelName = sku?.modelName ?? id;
  const serial = sku?.serial ?? '—';
  const start = w.startAt?.slice(0, 10) ?? '—';
  const endWhole = w.endAtWhole?.slice(0, 10) ?? '—';
  const endCell = w.endAtCell?.slice(0, 10) ?? '—';
  const endBms = w.endAtBms?.slice(0, 10) ?? '—';
  const endParts = w.endAtParts?.slice(0, 10) ?? '—';
  const statusClass =
    w.status === 'active' ? 'chip-green'
    : w.status === 'pending' ? 'chip-orange'
    : 'chip-red';
  const statusLabel =
    w.status === 'active' ? t.warranty.statusActive
    : w.status === 'pending' ? t.warranty.statusPending
    : w.status === 'expired' ? t.warranty.statusExpired
    : t.warranty.statusPending;

  return (
    <PhoneShell>
      <TopBar title={t.warranty.card} />
      <main className="flex-1 overflow-auto pb-6">
        {/* 卡片视觉 */}
        <section className="px-4 pt-2">
          <div className="rounded-2xl p-5 text-white shadow-card" style={{
            background: 'linear-gradient(135deg,#0E8F5A 0%,#0A6E45 100%)'
          }}>
            <div className="flex items-start justify-between">
              <div>
                <span className={`chip ${statusClass} bg-white/15 text-white`}>{statusLabel}</span>
                <div className="text-lg font-bold mt-1">{modelName}</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center font-bold">M</div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-y-3 text-sm">
              <div>
                <div className="text-[11px] opacity-70">{t.warranty.serial}</div>
                <div className="font-mono">{serial}</div>
              </div>
              <div>
                <div className="text-[11px] opacity-70">{t.warranty.startAt}</div>
                <div>{start}</div>
              </div>
              <div>
                <div className="text-[11px] opacity-70">{t.warranty.endAt}</div>
                <div>{endWhole}</div>
              </div>
              <div>
                <div className="text-[11px] opacity-70">{t.warranty.dealer}</div>
                <div>{w.dealerName ?? '—'}</div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between text-xs opacity-80">
              <span>Matoo Power Service</span>
              <span>app.matoopower.com</span>
            </div>
          </div>
        </section>

        {/* 保修期明细 */}
        <section className="px-4 mt-4">
          <h3 className="font-semibold mb-2">{t.warranty.coverages}</h3>
          <div className="card divide-y dark:divide-slate-700">
            {[
              { k: 'cov_whole' as const, m: 36, end: endWhole },
              { k: 'cov_cell' as const, m: 60, end: endCell },
              { k: 'cov_bms' as const, m: 36, end: endBms },
              { k: 'cov_parts' as const, m: 12, end: endParts },
            ].map((c, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-medium">{t.warranty[c.k]}</div>
                  <div className="text-xs text-slate-500">{c.m} months</div>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">→ {c.end}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 起算策略 */}
        <section className="px-4 mt-4">
          <div className="card p-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            <span className="font-semibold mr-1">起算策略:</span>
            {w.policy === 'INVOICE'
              ? `发票日 (${w.invoiceDate?.slice(0, 10) ?? '—'})`
              : `出厂日 + 60 天兜底`}
          </div>
        </section>

        <section className="px-4 mt-4 grid grid-cols-2 gap-3">
          <button onClick={() => window.print()} className="card p-3 text-sm font-medium">{t.warranty.download}</button>
          <button onClick={() => {
            if (typeof navigator !== 'undefined' && navigator.share) {
              navigator.share({ title: t.warranty.card, text: `${modelName} · ${serial}` }).catch(() => {});
            }
          }} className="card p-3 text-sm font-medium">{t.warranty.share}</button>
        </section>

        <section className="px-4 mt-4">
          <Link href={`/device/${id}`} className="btn-secondary">{t.warranty.viewDevice}</Link>
        </section>
      </main>
    </PhoneShell>
  );
}

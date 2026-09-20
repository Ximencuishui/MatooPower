'use client';
import { useEffect, useState } from 'react';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { LangSwitch } from '@/components/LangSwitch';
import { PageLoading } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { useT } from '@/lib/i18n';
import { getAnalyticsTrends, getAnalyticsBreakdown } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { getSession } from '@/lib/api/auth-store';

type Trends = Awaited<ReturnType<typeof getAnalyticsTrends>>;

export default function AdminAnalyticsPage() {
  const { t } = useT();
  const [days, setDays] = useState(30);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [warrantyBySku, setWarrantyBySku] = useState<Array<{ key: string; c: number }>>([]);
  const [ticketBySeverity, setTicketBySeverity] = useState<Array<{ key: string; c: number }>>([]);
  const [error, setError] = useState<unknown>(null);

  function load() {
    setError(null);
    const s = getSession();
    if (!s?.token) { setError(new ApiError(401, 'UNAUTHORIZED', t.ticket.needLoginAdmin)); return; }

    Promise.all([
      getAnalyticsTrends(days),
      getAnalyticsBreakdown('warranty', 'sku'),
      getAnalyticsBreakdown('ticket', 'severity'),
    ])
      .then(([tr, wb, ts]) => {
        setTrends(tr);
        setWarrantyBySku(wb.items);
        setTicketBySeverity(ts.items);
      })
      .catch((e: unknown) => setError(e));
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  if (error && !trends) {
    return (
      <PhoneShell>
        <TopBar title={t.adminAnalytics.title} right={<LangSwitch />} />
        <main className="p-4"><ErrorBlock error={error} onRetry={load} showLoginLink={error instanceof ApiError && error.status === 401} loginNext="/admin/analytics" /></main>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <TopBar title={t.adminAnalytics.title} right={<LangSwitch />} />
      <main className="flex-1 overflow-auto p-4 space-y-4">
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-full text-xs ${days === d ? 'bg-matoo text-white font-semibold' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
            >
              {t.adminAnalytics.days.replace('{n}', String(d))}
            </button>
          ))}
        </div>

        {!trends && <PageLoading />}

        {trends && (
          <>
            <SparkSection title={t.adminAnalytics.warrantyTrend} values={trends.warranty.map((d) => d.c)} labels={trends.warranty.map((d) => d.day.slice(5))} color="#0E8F5A" />
            <SparkSection title={t.adminAnalytics.deviceTrend} values={trends.device.map((d) => d.c)} labels={trends.device.map((d) => d.day.slice(5))} color="#3B82F6" />
            <SparkSection title={t.adminAnalytics.ticketTrend} values={trends.ticket.map((d) => d.c)} labels={trends.ticket.map((d) => d.day.slice(5))} color="#FF7A1A" />
          </>
        )}

        <section>
          <h3 className="text-sm font-semibold mb-2">{t.adminAnalytics.warrantyBySku}</h3>
          {warrantyBySku.length === 0 ? (
            <EmptyState icon="📊" title="—" />
          ) : (
            <div className="space-y-1">
              {warrantyBySku.map((b) => {
                const max = Math.max(...warrantyBySku.map((x) => x.c), 1);
                return (
                  <div key={b.key} className="flex items-center gap-2">
                    <div className="w-32 text-xs text-slate-700 dark:text-slate-300 truncate">{b.key}</div>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded h-5 relative">
                      <div className="bg-matoo h-5 rounded" style={{ width: `${(b.c / max) * 100}%` }} />
                      <span className="absolute right-2 top-0 leading-5 text-[10px] text-slate-600 dark:text-slate-300">{b.c}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2">{t.adminAnalytics.ticketBySeverity}</h3>
          {ticketBySeverity.length === 0 ? (
            <EmptyState icon="📊" title="—" />
          ) : (
            <div className="space-y-1">
              {ticketBySeverity.map((b) => {
                const max = Math.max(...ticketBySeverity.map((x) => x.c), 1);
                const color =
                  b.key === 'urgent' ? 'bg-red-500' :
                  b.key === 'high' ? 'bg-amber-500' :
                  b.key === 'normal' ? 'bg-slate-400' :
                  'bg-slate-300';
                return (
                  <div key={b.key} className="flex items-center gap-2">
                    <div className="w-24 text-xs text-slate-700 dark:text-slate-300">{b.key}</div>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded h-5 relative">
                      <div className={`${color} h-5 rounded`} style={{ width: `${(b.c / max) * 100}%` }} />
                      <span className="absolute right-2 top-0 leading-5 text-[10px] text-slate-600 dark:text-slate-300">{b.c}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </PhoneShell>
  );
}

/** P1-5:sparkline 加 SVG title tooltip + 数据点 hover */
function SparkSection({
  title, values, labels, color,
}: { title: string; values: number[]; labels: string[]; color: string }) {
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  // P1-4:环比:最近 7 天 vs 之前 7 天
  const last7 = values.slice(-7).reduce((a, b) => a + b, 0);
  const prev7 = values.slice(-14, -7).reduce((a, b) => a + b, 0);
  const delta = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : (last7 > 0 ? 100 : 0);
  const w = 320, h = 80, pad = 4;
  const n = values.length;
  if (n === 0) return null;
  const step = (w - pad * 2) / Math.max(n - 1, 1);
  const points = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (h - pad * 2) * (1 - v / max);
    return { x, y, v, label: labels[i] };
  });
  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = values[values.length - 1] ?? 0;

  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-slate-500">最近 {n} 天 · 累计 <span className="font-bold text-matoo-dark">{total}</span>{prev7 > 0 && (
          <span className={`ml-2 ${delta > 0 ? 'text-red-500' : delta < 0 ? 'text-matoo' : 'text-slate-400'}`}>
            {delta > 0 ? '↑' : delta < 0 ? '↓' : '·'} {Math.abs(delta)}%
          </span>
        )}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
        <title>{title}:最近 {n} 天,累计 {total},最近一天 {last}</title>
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.8" fill={color} opacity="0.6">
            <title>{p.label}: {p.v}</title>
          </circle>
        ))}
        {labels.length > 0 && (
          <>
            <text x={pad} y={h - 1} fontSize="9" fill="#94A3B8">{labels[0]}</text>
            <text x={w - pad - 20} y={h - 1} fontSize="9" fill="#94A3B8">{labels[labels.length - 1]}</text>
          </>
        )}
      </svg>
      <div className="text-[11px] text-slate-400 mt-1">最近一天:<span className="font-mono text-matoo-dark">{last}</span></div>
    </section>
  );
}

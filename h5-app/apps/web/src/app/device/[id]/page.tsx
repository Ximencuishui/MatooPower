'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { ProductArt } from '@/components/ProductArt';
import { PageLoading, Spinner } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { useT } from '@/lib/i18n';
import { getDeviceHealth, triggerDiagnostics } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { toast, toastSuccess } from '@/components/Toast';
import type { DeviceHealthDto, DiagnosticsResult } from '@/lib/api/endpoints';

export default function DevicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useT();
  const id = decodeURIComponent(params.id);

  const [health, setHealth] = useState<DeviceHealthDto | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  function load() {
    setLoading(true);
    setError(null);
    getDeviceHealth(id)
      .then((h) => { setHealth(h); setLoading(false); })
      .catch((e: unknown) => {
        setError(e);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function runDiagnostics() {
    setDiagBusy(true);
    triggerDiagnostics(id)
      .then((r) => {
        setDiagnostics(r);
        toastSuccess(t.device.diagRun + ' ✓');
      })
      .catch((e: unknown) => {
        setError(e);
        toast(e instanceof ApiError ? e.message : t.device.diagFailed, 'error');
      })
      .finally(() => setDiagBusy(false));
  }

  if (loading) {
    return (
      <PhoneShell>
        <TopBar title={t.device.title} />
        <main className="p-5"><PageLoading /></main>
      </PhoneShell>
    );
  }

  if (error || !health) {
    return (
      <PhoneShell>
        <TopBar title={t.device.title} />
        <main className="p-4 space-y-3">
          <ErrorBlock
            error={error ?? 'Device not found'}
            onRetry={load}
            showLoginLink={error instanceof ApiError && error.status === 401}
            loginNext={`/device/${id}`}
          />
        </main>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <TopBar title={t.device.title} />
      <main className="flex-1 overflow-auto pb-6">
        <div className="p-4">
          <div className="card p-4">
            <ProductArt variant="battery" />
            <div className="mt-3 text-[15px] font-bold">{health.skuId}</div>
            <div className="text-xs text-slate-500 font-mono">{health.id}</div>
            <div className="mt-2 text-[11px]">
              <span className={`chip ${health.online ? 'chip-green' : 'chip-orange'}`} role="status">
                {health.online ? '● Online' : '● Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* 健康看板 */}
        <section className="px-4">
          <h3 className="font-semibold mb-2">{t.device.overview}</h3>
          <div className="grid grid-cols-3 gap-3">
            <Metric label={t.device.soh} value={`${health.soh} %`} />
            <Metric label={t.device.soc} value={`${health.soc} %`} />
            <Metric label={t.device.cycles} value={`${health.cycles}`} />
            <Metric label={t.device.temp} value={`${health.temp} °C`} />
            <Metric label={t.device.volt} value={`${health.volt} V`} />
            <Metric label={t.device.curr} value={`${health.curr} A`} />
          </div>
        </section>

        {/* SoC 趋势(带 hover tooltip) */}
        <section className="px-4 mt-4">
          <h3 className="font-semibold mb-2">{t.device.soc} · {t.device.trend6h}</h3>
          <div className="card p-4">
            <SparkLine values={health.trend.socLast6h} />
          </div>
        </section>

        {/* 告警记录 */}
        <section className="px-4 mt-4">
          <h3 className="font-semibold mb-2">{t.device.alarms} · {health.alarms}</h3>
          <div className="card p-4 text-sm text-slate-500 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${health.alarms === 0 ? 'bg-matoo' : 'bg-red-500'}`} />
            <span>{health.alarms === 0 ? t.device.noAlarms : `${health.alarms} ${t.device.alarmCount}`}</span>
          </div>
        </section>

        {/* 远程升级占位 — 加 chip-orange 标签 */}
        <section className="px-4 mt-4">
          <div className="card p-4 flex items-center justify-between gap-2">
            <div className="flex-1">
              <div className="text-sm font-medium">{t.device.upgrade}</div>
              <div className="text-xs text-slate-500">{t.device.fw} {health.fw} · {t.device.upgradeSoon}</div>
            </div>
            <span className="chip chip-orange">{t.common.comingSoon}</span>
          </div>
        </section>

        {/* 远程诊断 */}
        <section className="px-4 mt-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">🔍 {t.device.diagnostics}</div>
              <button onClick={runDiagnostics} disabled={diagBusy} className="text-xs px-3 py-1.5 rounded-md bg-matoo text-white disabled:opacity-50 inline-flex items-center gap-1">
                {diagBusy ? <Spinner size="sm" /> : null}
                {diagBusy ? t.common.loading : t.device.diagRun}
              </button>
            </div>
            {!diagnostics && <div className="text-xs text-slate-400">{t.device.diagHint}</div>}
            {diagnostics && (
              <div className="space-y-2">
                <div className="text-[11px] text-slate-500">
                  {t.device.diagAt}:{new Date(diagnostics.startedAt).toLocaleString()} · {diagnostics.durationMs}ms · {t.device.diagSummary}:
                  <span className={
                    diagnostics.summary === 'critical' ? 'text-red-600 font-semibold ml-1' :
                    diagnostics.summary === 'warn' ? 'text-amber-600 font-semibold ml-1' :
                    'text-matoo-dark font-semibold ml-1'
                  }>{diagnostics.summary.toUpperCase()}</span>
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300">{diagnostics.recommendation}</div>
                <div className="space-y-1">
                  {diagnostics.findings.map((f, i) => (
                    <div key={i} className={`text-xs p-2 rounded-lg ${
                      f.severity === 'critical' ? 'bg-red-50 text-red-700' :
                      f.severity === 'warn' ? 'bg-amber-50 text-amber-800' :
                      'bg-slate-50 text-slate-600'
                    }`}>
                      <span className="font-mono text-[10px] mr-2">[{f.code}]</span>{f.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="px-4 mt-4 grid grid-cols-2 gap-3">
          <Link href={`/warranty/${health.skuId}`} className="btn-secondary">{t.device.viewWarranty}</Link>
          <Link href={`/tickets/new?deviceId=${encodeURIComponent(health.id)}`} className="btn-primary">{t.ticket.newTitle}</Link>
        </section>
      </main>
    </PhoneShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-matoo-dark">{value}</div>
    </div>
  );
}

/** P1-5:sparkline 带 SVG title hover tooltip + 高亮点 */
function SparkLine({ values }: { values: number[] }) {
  if (values.length === 0) return <div className="text-xs text-slate-400">—</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 280, h = 60, pad = 4;
  const step = (w - pad * 2) / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return { x, y, v };
  });
  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = values[values.length - 1] ?? 0;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
      <title>SoC 趋势:最近 6 小时,当前 {last}</title>
      <polyline points={polyline} fill="none" stroke="#0E8F5A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.8" fill="#0E8F5A" opacity="0.6">
          <title>{p.v}</title>
        </circle>
      ))}
    </svg>
  );
}

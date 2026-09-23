// Admin 概览页（桌面端 KPI 看板）
'use client';

import { useEffect, useState } from 'react';
import { getAdminOverview, getAdminTrends } from '@/lib/api/operations';
import { useRequireRole, RoleGuardView } from '@/lib/useRequireRole';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';
import type { AdminOverviewDto, AdminTrendsDto } from '@/lib/api/operations';

export default function AdminOverviewPage() {
  const guard = useRequireRole(['admin']);
  const [data, setData] = useState<AdminOverviewDto['overview'] | null>(null);
  const [trends, setTrends] = useState<AdminTrendsDto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (guard.status !== 'ok') return;
    const ac = new AbortController();
    setError(null);
    Promise.all([
      getAdminOverview(ac.signal),
      getAdminTrends(ac.signal).catch(() => null),
    ])
      .then(([o, t]) => {
        setData(o.overview);
        if (t) setTrends(t);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
    return () => ac.abort();
  }, [guard.status, reloadKey]);

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title="运营概览" />;
  }

  return (
    <div className="px-8 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">运营概览</h1>
          <p className="text-sm text-slate-500 mt-1">
            当前 SKU / 用户 / 保修 / 设备 / 工单 KPI
          </p>
        </div>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="btn-secondary"
        >
          刷新
        </button>
      </header>

      {error !== null && !data && <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {!data && !error && <PageLoading />}

      {data && (
        <>
          {/* KPI 卡片 */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <Kpi label="SKU 总数" value={data.sku.total} sub={`已激活 ${data.sku.activated}`} accent="green" />
            <Kpi label="用户总数" value={data.user.total} sub={`经销商 ${data.user.dealer}`} accent="blue" />
            <Kpi
              label="在保中保修"
              value={data.warranty.active}
              sub={`本月新增 ${data.warranty.activeThisMonth}`}
              accent="purple"
              highlight
            />
            <Kpi label="设备总数" value={data.device.total} sub={`本月绑定 ${data.device.boundThisMonth}`} accent="orange" />
            <Kpi
              label="待处理工单"
              value={data.ticket.open}
              sub={`紧急 ${data.ticket.urgent} · 本月新增 ${data.ticket.newThisMonth}`}
              accent="red"
            />
          </section>

          {/* 紧急告警 */}
          {data.ticket.urgent >= 5 && (
            <div className="card p-4 mt-5 border-rose-200 bg-rose-50/40 flex items-center gap-3">
              <div className="text-2xl">⚠</div>
              <div className="flex-1">
                <div className="font-semibold text-rose-700">
                  紧急工单达 {data.ticket.urgent} 条
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  建议立即在客服工作台处理。
                </div>
              </div>
            </div>
          )}

          {/* 趋势图 */}
          {trends && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
                近 30 日趋势
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <SparkCard
                  title="激活保修"
                  points={trends.warranty}
                  color="#0E8F5A"
                />
                <SparkCard
                  title="绑定设备"
                  points={trends.device}
                  color="#FF7A1A"
                />
                <SparkCard
                  title="新增工单"
                  points={trends.ticket}
                  color="#E11D48"
                />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent = 'gray',
  highlight = false,
}: {
  label: string;
  value: number;
  sub: string;
  accent?: 'gray' | 'green' | 'blue' | 'purple' | 'orange' | 'red';
  highlight?: boolean;
}) {
  const accentBar = {
    gray: 'bg-slate-400',
    green: 'bg-emerald-500',
    blue: 'bg-sky-500',
    purple: 'bg-violet-500',
    orange: 'bg-orange-500',
    red: 'bg-rose-500',
  }[accent];
  return (
    <div className={`kpi relative overflow-hidden ${highlight ? 'ring-1 ring-matoo/30' : ''}`}>
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${accentBar}`} aria-hidden="true" />
      <div className="kpi-label pl-2">{label}</div>
      <div className="kpi-value pl-2">{value.toLocaleString()}</div>
      <div className="kpi-sub pl-2">{sub}</div>
    </div>
  );
}

interface TrendPoint { day: string; c: number }

function SparkCard({
  title,
  points,
  color,
}: {
  title: string;
  points: TrendPoint[];
  color: string;
}) {
  const W = 320;
  const H = 80;
  const safe = points.map((p) => ({ day: p.day, c: Number(p.c) || 0 }));
  const max = Math.max(1, ...safe.map((p) => p.c));
  const stepX = safe.length > 1 ? W / (safe.length - 1) : W;
  const pathD = safe
    .map((p, i) => {
      const x = i * stepX;
      const y = H - (p.c / max) * (H - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const areaD = `${pathD} L${W},${H} L0,${H} Z`;
  const total = safe.reduce((s, p) => s + p.c, 0);
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-slate-500">30 天合计 {total}</div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${title} 近 30 日趋势`}
      >
        <path d={areaD} fill={color} opacity="0.12" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
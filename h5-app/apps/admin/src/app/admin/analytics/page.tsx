// Admin 数据分析 — 趋势 + 分布（柱状图 + SVG）
// 契约对齐后端:GET /admin/analytics/trends + 三次 /admin/analytics/breakdown
'use client';

import { useEffect, useState } from 'react';
import {
  getAdminTrends,
  getAdminBreakdown,
  type AdminTrendsDto,
  type AdminBreakdownItem,
} from '@/lib/api/operations';
import { useRequireRole, RoleGuardView } from '@/lib/useRequireRole';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';

export default function AdminAnalyticsPage() {
  const guard = useRequireRole(['admin']);
  const [trends, setTrends] = useState<AdminTrendsDto | null>(null);
  const [ticketsByStatus, setTicketsByStatus] = useState<AdminBreakdownItem[] | null>(null);
  const [warrantiesBySku, setWarrantiesBySku] = useState<AdminBreakdownItem[] | null>(null);
  const [usersByRole, setUsersByRole] = useState<AdminBreakdownItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (guard.status !== 'ok') return;
    const ac = new AbortController();
    setError(null);
    Promise.all([
      getAdminTrends(ac.signal),
      // 后端 breakdown 是单维度查询,前端把 3 个关心的分布并行拉,任一失败不阻塞其余
      getAdminBreakdown('ticket', 'severity', ac.signal)
        .then((r) => setTicketsByStatus(r.items))
        .catch((e: unknown) => {
          if ((e as { name?: string })?.name === 'AbortError') return;
          throw e;
        }),
      getAdminBreakdown('warranty', 'sku', ac.signal)
        .then((r) => setWarrantiesBySku(r.items))
        .catch((e: unknown) => {
          if ((e as { name?: string })?.name === 'AbortError') return;
          throw e;
        }),
      // 后端 breakdown(type, groupBy)路由表(见 apps/api/src/modules/admin/admin.service.ts):
      //   warranty/sku → Warranty by SKU
      //   warranty/*  → Warranty by country
      //   device/sku  → Device by SKU
      //   device/*    → SELECT role FROM User GROUP BY role(实际取用户角色分布)
      //   ticket/severity → Ticket by severity
      //   ticket/*    → Ticket by status
      // 因此"用户角色"走 type='device' + groupBy='role',这是后端约定。
      getAdminBreakdown('device', 'role', ac.signal)
        .then((r) => setUsersByRole(r.items))
        .catch((e: unknown) => {
          if ((e as { name?: string })?.name === 'AbortError') return;
          throw e;
        }),
    ])
      .then(([t]) => {
        setTrends(t);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
    return () => ac.abort();
  }, [guard.status, reloadKey]);

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title="数据分析" />;
  }

  const breakdownReady =
      trends !== null &&
      ticketsByStatus !== null &&
      warrantiesBySku !== null &&
      usersByRole !== null;

  return (
    <div className="px-8 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">数据分析</h1>
          <p className="text-sm text-slate-500 mt-1">近 30 日趋势 + 当前分布</p>
        </div>
        <button onClick={() => setReloadKey((k) => k + 1)} className="btn-secondary">
          刷新
        </button>
      </header>

      {error !== null && !breakdownReady && (
        <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      )}

      {!breakdownReady && error === null && <PageLoading />}

      {trends && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
            30 日趋势
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TrendChart title="激活保修" points={trends.warranty} color="#0E8F5A" />
            <TrendChart title="绑定设备" points={trends.device} color="#FF7A1A" />
            <TrendChart title="新增工单" points={trends.ticket} color="#E11D48" />
          </div>
        </section>
      )}

      {(ticketsByStatus || warrantiesBySku || usersByRole) && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
            当前分布
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BarList title="工单严重度" rows={ticketsByStatus ?? []} color="#FF7A1A" />
            <BarList title="保修 SKU Top" rows={warrantiesBySku ?? []} color="#0E8F5A" />
            <BarList title="用户角色" rows={usersByRole ?? []} color="#6366F1" />
          </div>
        </section>
      )}
    </div>
  );
}

function TrendChart({
  title,
  points,
  color,
}: {
  title: string;
  points: Array<{ day: string; c: number }>;
  color: string;
}) {
  const W = 600;
  const H = 140;
  // 后端字段为 c;Number() 防御 null/undefined
  const safe = points.map((p) => ({ day: p.day, c: Number(p.c) || 0 }));
  const max = Math.max(1, ...safe.map((p) => p.c));
  const stepX = safe.length > 1 ? W / (safe.length - 1) : W;
  const pathD = safe
    .map((p, i) => {
      const x = i * stepX;
      const y = H - (p.c / max) * (H - 12) - 6;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const areaD = `${pathD} L${W},${H} L0,${H} Z`;
  const total = safe.reduce((s, p) => s + p.c, 0);
  return (
    <div className="card p-5">
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
        aria-label={`${title} 近 30 日`}
      >
        <path d={areaD} fill={color} opacity="0.12" />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function BarList({
  title,
  rows,
  color,
}: {
  title: string;
  rows: AdminBreakdownItem[];
  color: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="card p-5">
        <div className="text-sm font-semibold mb-3">{title}</div>
        <div className="text-xs text-slate-400">暂无数据</div>
      </div>
    );
  }
  const max = Math.max(1, ...rows.map((r) => Number(r.c) || 0));
  return (
    <div className="card p-5">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div className="space-y-2.5">
        {rows.map((r, i) => {
          const label = String(r.key ?? '—');
          const count = Number(r.c) || 0;
          const pct = (count / max) * 100;
          return (
            <div key={`${label}-${i}`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-700 truncate">{label}</span>
                <span className="text-slate-500 font-mono">{count}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
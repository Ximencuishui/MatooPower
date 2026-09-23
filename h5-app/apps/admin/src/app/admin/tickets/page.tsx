// Admin 工单管理 — 桌面端表格视图
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  listTickets,
  getTicketStats,
  getSlaStats,
  runSlaSweep,
  type AdminTicketItem,
  type TicketStatus,
  type TicketSeverity,
} from '@/lib/api/operations';
import { useRequireRole, RoleGuardView } from '@/lib/useRequireRole';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { TicketDetailDrawer } from '@/components/drawers/TicketDetailDrawer';
import { useLocale } from '@/lib/useLocale';
import { getDict } from '@/lib/i18n';

const STATUS_OPTIONS: Array<{ key: TicketStatus | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'open', label: '待处理' },
  { key: 'in_progress', label: '处理中' },
  { key: 'waiting_customer', label: '等待客户' },
  { key: 'resolved', label: '已解决' },
  { key: 'closed', label: '已关闭' },
];

const SEVERITY_CHIP: Record<TicketSeverity, string> = {
  low: 'chip-gray',
  normal: 'chip-blue',
  high: 'chip-orange',
  urgent: 'chip-red',
};
const SEVERITY_LABEL: Record<TicketSeverity, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
};

const STATUS_CHIP: Record<TicketStatus, string> = {
  open: 'chip-orange',
  in_progress: 'chip-blue',
  waiting_customer: 'chip-purple',
  resolved: 'chip-green',
  closed: 'chip-gray',
};
const STATUS_LABEL: Record<TicketStatus, string> = {
  open: '待处理',
  in_progress: '处理中',
  waiting_customer: '等待客户',
  resolved: '已解决',
  closed: '已关闭',
};

export default function AdminTicketsPage() {
  const guard = useRequireRole(['admin']);
  const { locale } = useLocale();
  const dict = getDict(locale);
  const [status, setStatus] = useState<TicketStatus | 'all'>('all');
  const [items, setItems] = useState<AdminTicketItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [ticketStats, setTicketStats] = useState<{
    open: number;
    resolved: number;
    urgent: number;
    todayNew: number;
  } | null>(null);
  const [slaStats, setSlaStats] = useState<{
    openOver2h: number;
    highOver4h: number;
  } | null>(null);
  const [sweeping, setSweeping] = useState(false);

  useEffect(() => {
    if (guard.status !== 'ok') return;
    const ac = new AbortController();
    setError(null);
    listTickets(
      { status: status === 'all' ? undefined : status, pageSize: 200 },
      ac.signal,
    )
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
    return () => ac.abort();
  }, [status, guard.status, reloadKey]);

  // SLA / Stats 独立拉取（与列表条件解耦，刷新列表时不影响）
  useEffect(() => {
    if (guard.status !== 'ok') return;
    const ac = new AbortController();
    Promise.all([getTicketStats(ac.signal), getSlaStats(ac.signal)])
      .then(([t, s]) => {
        setTicketStats(t.stats);
        setSlaStats({ openOver2h: s.openOver2h, highOver4h: s.highOver4h });
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        // SLA 加载失败不阻塞主列表
        console.warn('SLA stats load failed', e);
      });
    return () => ac.abort();
  }, [guard.status, reloadKey]);

  async function handleSweep() {
    if (sweeping) return;
    setSweeping(true);
    try {
      const r = await runSlaSweep();
      alert(`${dict.sla.sweepDone}：升级 ${r.upgraded} 条`);
      setReloadKey((k) => k + 1);
    } catch (e) {
      alert('扫描失败: ' + (e as Error).message);
    } finally {
      setSweeping(false);
    }
  }

  const groupedCounts = useMemo(() => {
    const m: Record<string, number> = {};
    (items ?? []).forEach((t) => {
      m[t.status] = (m[t.status] ?? 0) + 1;
    });
    return m;
  }, [items]);

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title="工单管理" />;
  }

  return (
    <div className="px-8 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">工单管理</h1>
          <p className="text-sm text-slate-500 mt-1">
            所有用户工单（共 {total} 条）
          </p>
        </div>
        <button onClick={() => setReloadKey((k) => k + 1)} className="btn-secondary">
          刷新
        </button>
      </header>

      {/* 状态 Tab */}
      <div className="flex items-center gap-2 mb-4 border-b border-slate-200">
        {STATUS_OPTIONS.map((opt) => {
          const active = status === opt.key;
          const count = opt.key === 'all' ? total : groupedCounts[opt.key] ?? 0;
          return (
            <button
              key={opt.key}
              onClick={() => setStatus(opt.key)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px transition ${
                active
                  ? 'border-matoo text-matoo-dark font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
              <span className={`ml-2 text-xs ${active ? 'text-matoo' : 'text-slate-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {error !== null && !items && (
        <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      )}
      {!items && !error && <PageLoading />}

      {/* SLA / 工单 KPI 区 */}
      {(ticketStats || slaStats) && (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <Kpi label={dict.sla.open} value={ticketStats?.open ?? 0} accent="orange" />
          <Kpi label={dict.sla.urgent} value={ticketStats?.urgent ?? 0} accent="red" />
          <Kpi label={dict.sla.today} value={ticketStats?.todayNew ?? 0} accent="blue" />
          <Kpi
            label={dict.sla.over2h}
            value={slaStats?.openOver2h ?? 0}
            accent={(slaStats?.openOver2h ?? 0) > 0 ? 'red' : 'gray'}
          />
          <Kpi
            label={dict.sla.over4h}
            value={slaStats?.highOver4h ?? 0}
            accent={(slaStats?.highOver4h ?? 0) > 0 ? 'red' : 'gray'}
          />
          <button
            onClick={handleSweep}
            disabled={sweeping}
            className="card p-4 flex flex-col items-center justify-center text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            <span className="text-2xl mb-1">🔄</span>
            <span className="font-medium text-matoo-dark dark:text-matoo-light">
              {sweeping ? dict.sla.sweepRunning : dict.sla.sweep}
            </span>
          </button>
        </section>
      )}
      {items && items.length === 0 && <EmptyState title="暂无工单" />}

      {items && items.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="table-th">主题</th>
                <th className="table-th">提交用户</th>
                <th className="table-th">状态</th>
                <th className="table-th">严重度</th>
                <th className="table-th">更新时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-slate-50/60 cursor-pointer"
                  onClick={() => setOpenId(t.id)}
                >
                  <td className="table-td">
                    <div className="font-medium">{t.subject}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{t.id}</div>
                  </td>
                  <td className="table-td">
                    <div className="text-sm">{t.userDisplayName ?? t.userPhone ?? t.userId}</div>
                    {t.userPhone && (
                      <div className="text-[11px] text-slate-500 font-mono">{t.userPhone}</div>
                    )}
                  </td>
                  <td className="table-td">
                    <span className={`chip ${STATUS_CHIP[t.status] ?? 'chip-gray'}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="table-td">
                    <span className={`chip ${SEVERITY_CHIP[t.severity] ?? 'chip-gray'}`}>
                      {SEVERITY_LABEL[t.severity] ?? t.severity}
                    </span>
                  </td>
                  <td className="table-td text-xs text-slate-500">
                    {new Date(t.updatedAt).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TicketDetailDrawer
        ticketId={openId}
        open={!!openId}
        onClose={() => setOpenId(null)}
        onChanged={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}

/* ===== 本地轻量 KPI（无 sub 文案；SLA 用） ===== */
function Kpi({
  label,
  value,
  accent = 'gray',
  highlight = false,
}: {
  label: string;
  value: number;
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
    </div>
  );
}
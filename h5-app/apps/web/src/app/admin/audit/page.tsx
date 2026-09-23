'use client';
// v1.4 P1-5:管理员审计日志页 — 全局最近审计 + 按资源前缀过滤 + payload 抽屉
// 后端 /admin/audit 端点(admin only)+ /admin/audit/warranty/:id(per-resource trail)
// 字段:id / actorUserId / actorRole / action / resource / payload(JSON) / ip / createdAt

import { useMemo, useState } from 'react';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar, AdminBreadcrumb } from '@/components/TopBar';
import { LangSwitch } from '@/components/LangSwitch';
import { PageLoading } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { Drawer } from '@/components/Drawer';
import { useT } from '@/lib/i18n';
import { listAdminAudit } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { useRequireRole, RoleGuardView } from '@/hooks/useRequireRole';
import { useAbortedFetch } from '@/hooks/useAbortedFetch';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';

type AuditItem = {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  resource: string | null;
  payload: unknown;
  ip: string | null;
  createdAt: string;
};

type FilterKey = 'all' | 'warranty' | 'ticket' | 'user' | 'gdpr';

const FILTER_PREFIX: Record<Exclude<FilterKey, 'all'>, string> = {
  warranty: 'admin:warranties:',
  ticket: 'admin:tickets:',
  user: 'admin:users:',
  gdpr: 'user:',
};

// 类型安全地把 FilterKey → i18n key
type AdminAuditDict = typeof import('@/locales/zh-CN').zh.adminAudit;
const FILTER_LABEL: Record<FilterKey, keyof AdminAuditDict> = {
  all: 'filterAll',
  warranty: 'filterWarranty',
  ticket: 'filterTicket',
  user: 'filterUser',
  gdpr: 'filterGdpr',
};

export default function AdminAuditPage() {
  const { t } = useT();
  const { formatDateTime } = useLocaleFormat();
  const guard = useRequireRole(['admin']);
  const [items, setItems] = useState<AuditItem[] | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selected, setSelected] = useState<AuditItem | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  function load() {
    setError(null);
    setReloadKey((k) => k + 1);
  }

  useAbortedFetch((signal) => {
    if (guard.status !== 'ok') return;
    setError(null);
    listAdminAudit({ limit: 200 }, { signal })
      .then((r) => setItems(r.items as AuditItem[]))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
  }, [guard.status, reloadKey]);

  const filtered = useMemo(() => {
    if (!items) return null;
    if (filter === 'all') return items;
    const prefix = FILTER_PREFIX[filter];
    return items.filter((it) => (it.resource ?? '').startsWith(prefix) || (it.action ?? '').includes(prefix));
  }, [items, filter]);

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title={t.adminAudit.title} />;
  }

  if (error && !items) {
    return (
      <PhoneShell>
        <TopBar title={t.adminAudit.title} leftExtra={<AdminBreadcrumb />} right={<LangSwitch />} />
        <main className="p-4">
          <ErrorBlock
            error={error}
            onRetry={load}
            showLoginLink={error instanceof ApiError && error.status === 401}
            loginNext="/admin/audit"
          />
        </main>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <TopBar title={t.adminAudit.title} leftExtra={<AdminBreadcrumb />} right={<LangSwitch />} />

      <main className="flex-1 overflow-auto pb-6">
        {/* 过滤 Tab */}
        <div className="px-4 mt-3">
          <div role="tablist" className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs overflow-x-auto">
            {(['all', 'warranty', 'ticket', 'user', 'gdpr'] as FilterKey[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={filter === k}
                onClick={() => setFilter(k)}
                className={`flex-1 py-2 px-2 rounded-lg whitespace-nowrap ${
                  filter === k ? 'bg-white dark:bg-slate-800 shadow-sm font-semibold' : 'text-slate-500'
                }`}
              >
                {t.adminAudit[FILTER_LABEL[k]]}
              </button>
            ))}
          </div>
        </div>

        {/* 总览 */}
        <section className="px-4 mt-3">
          <div className="card p-3 text-xs text-slate-500 dark:text-slate-400">
            {t.adminAudit.summary.replace('{n}', String(filtered?.length ?? 0))}
          </div>
        </section>

        <section className="px-4 mt-3 space-y-2">
          {!items && <PageLoading />}
          {items && filtered && filtered.length === 0 && (
            <EmptyState icon="📜" title={t.adminAudit.empty} />
          )}
          {filtered?.map((it) => (
            <button
              key={it.id}
              onClick={() => setSelected(it)}
              className="card p-3 w-full text-left text-xs"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono font-semibold text-matoo-dark truncate flex-1">
                  {it.action}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">
                  {formatDateTime(it.createdAt)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                {it.resource && (
                  <span className="font-mono text-slate-600 dark:text-slate-300 truncate">
                    {t.adminAudit.columnResource}: <span className="font-semibold">{it.resource}</span>
                  </span>
                )}
                {it.actorUserId && (
                  <span className="text-slate-500 dark:text-slate-400 truncate">
                    {t.adminAudit.columnActor}: <span className="font-mono">{it.actorUserId.slice(0, 12)}…</span>
                    {it.actorRole && <span className="ml-1 chip text-[9px]">{it.actorRole}</span>}
                  </span>
                )}
                {it.ip && (
                  <span className="text-slate-400 dark:text-slate-500 font-mono">
                    {t.adminAudit.columnIp}: {it.ip}
                  </span>
                )}
              </div>
            </button>
          ))}
        </section>
      </main>

      {/* 详情 Drawer — 显示 payload */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={t.adminAudit.payloadTitle}>
        {selected && (
          <div className="p-4 space-y-3 text-xs">
            <div>
              <div className="text-slate-500 dark:text-slate-400">{t.adminAudit.columnAction}</div>
              <div className="font-mono font-semibold mt-1 break-all">{selected.action}</div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">{t.adminAudit.columnResource}</div>
              <div className="font-mono mt-1 break-all">{selected.resource ?? '—'}</div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">{t.adminAudit.columnActor}</div>
              <div className="font-mono mt-1">
                {selected.actorUserId ?? '—'}
                {selected.actorRole && <span className="ml-2 chip text-[9px]">{selected.actorRole}</span>}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">{t.adminAudit.columnTime}</div>
              <div className="font-mono mt-1">{formatDateTime(selected.createdAt)}</div>
            </div>
            {selected.ip && (
              <div>
                <div className="text-slate-500 dark:text-slate-400">{t.adminAudit.columnIp}</div>
                <div className="font-mono mt-1">{selected.ip}</div>
              </div>
            )}
            <div>
              <div className="text-slate-500 dark:text-slate-400 mb-1">{t.adminAudit.payloadLabel}</div>
              <pre className="card p-3 text-[10px] overflow-x-auto whitespace-pre-wrap break-all bg-slate-50 dark:bg-slate-800/40">
                {selected.payload == null
                  ? '—'
                  : typeof selected.payload === 'string'
                    ? selected.payload
                    : JSON.stringify(selected.payload, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Drawer>
    </PhoneShell>
  );
}
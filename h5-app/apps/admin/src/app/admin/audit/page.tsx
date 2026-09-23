// Admin 审计日志（桌面端表格）—— 过滤 + 详情 Drawer
'use client';

import { useEffect, useState } from 'react';
import { listAudit, type AuditLogItem } from '@/lib/api/operations';
import { useRequireRole, RoleGuardView } from '@/lib/useRequireRole';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { AuditDetailDrawer } from '@/components/drawers/AuditDetailDrawer';
import { useLocale } from '@/lib/useLocale';
import { getDict } from '@/lib/i18n';

export default function AdminAuditPage() {
  const guard = useRequireRole(['admin']);
  const { locale } = useLocale();
  const dict = getDict(locale);
  const [resource, setResource] = useState('');
  const [items, setItems] = useState<AuditLogItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [openLog, setOpenLog] = useState<AuditLogItem | null>(null);

  useEffect(() => {
    if (guard.status !== 'ok') return;
    const ac = new AbortController();
    setError(null);
    listAudit(
      { resource: resource.trim() || undefined, limit: 200 },
      ac.signal,
    )
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e as Error);
      });
    return () => ac.abort();
  }, [resource, guard.status, reloadKey]);

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title={dict.audit.title} />;
  }

  return (
    <div className="px-8 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{dict.audit.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {dict.audit.subtitle.replace('{total}', String(total))}
          </p>
        </div>
        <button onClick={() => setReloadKey((k) => k + 1)} className="btn-secondary">
          {dict.audit.refresh}
        </button>
      </header>

      <div className="mb-5">
        <input
          type="search"
          value={resource}
          onChange={(e) => setResource(e.target.value)}
          placeholder={dict.audit.searchResource}
          className="input max-w-md"
        />
      </div>

      {error && <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />}
      {!items && !error && <PageLoading />}
      {items && items.length === 0 && <EmptyState title={dict.audit.noLogs} />}

      {items && items.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="table-th">{dict.audit.when}</th>
                <th className="table-th">{dict.audit.actor}</th>
                <th className="table-th">{dict.audit.role}</th>
                <th className="table-th">{dict.audit.action}</th>
                <th className="table-th">{dict.audit.resource}</th>
                <th className="table-th">{dict.audit.ip}</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr
                  key={l.id}
                  className="hover:bg-slate-50/60 cursor-pointer"
                  onClick={() => setOpenLog(l)}
                >
                  <td className="table-td text-xs text-slate-500">
                    {new Date(l.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="table-td font-mono text-xs">
                    {l.actorUserId ?? '—'}
                  </td>
                  <td className="table-td">
                    {l.actorRole && (
                      <span className="chip chip-purple">{l.actorRole}</span>
                    )}
                  </td>
                  <td className="table-td text-sm font-medium">{l.action}</td>
                  <td className="table-td font-mono text-xs max-w-[280px] truncate">
                    {l.resource ?? '—'}
                  </td>
                  <td className="table-td font-mono text-xs">{l.ip ?? '—'}</td>
                  <td className="table-td">
                    <span className="text-xs text-matoo hover:underline">
                      {dict.audit.viewPayload}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AuditDetailDrawer
        log={openLog}
        open={!!openLog}
        onClose={() => setOpenLog(null)}
      />
    </div>
  );
}
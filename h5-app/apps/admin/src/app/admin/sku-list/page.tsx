// Admin SKU 商品列表（桌面端表格）—— 仅读取，不写
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { listAdminSkus, type AdminSkuItem } from '@/lib/api/operations';
import { useRequireRole, RoleGuardView } from '@/lib/useRequireRole';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { useLocale } from '@/lib/useLocale';
import { getDict } from '@/lib/i18n';

const FAMILY_LABEL: Record<string, string> = {
  battery: '电池',
  controller: '控制器',
  panel: '面板',
};

export default function AdminSkuListPage() {
  const guard = useRequireRole(['admin']);
  const { locale } = useLocale();
  const dict = getDict(locale);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [items, setItems] = useState<AdminSkuItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (guard.status !== 'ok') return;
    const ac = new AbortController();
    setError(null);
    listAdminSkus({ q: debounced.trim() || undefined, pageSize: 200 }, ac.signal)
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
    return () => ac.abort();
  }, [debounced, guard.status, reloadKey]);

  const activatedCount = useMemo(
    () => (items ?? []).filter((s) => s.activated).length,
    [items],
  );

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title={dict.skuList.title} />;
  }

  return (
    <div className="px-8 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{dict.skuList.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {dict.skuList.subtitle.replace('{total}', String(total))} ·{' '}
            <span className="text-emerald-600">{dict.skuList.activated} {activatedCount}</span>
          </p>
        </div>
        <button onClick={() => setReloadKey((k) => k + 1)} className="btn-secondary">
          {dict.audit.refresh}
        </button>
      </header>

      <div className="mb-5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={dict.skuList.search}
          className="input max-w-md"
        />
      </div>

      {error !== null && !items && (
        <ErrorBlock error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      )}
      {!items && !error && <PageLoading />}
      {items && items.length === 0 && <EmptyState title={dict.common.empty} />}

      {items && items.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="table-th">SKU</th>
                <th className="table-th">型号</th>
                <th className="table-th">分类</th>
                <th className="table-th">容量</th>
                <th className="table-th">电压</th>
                <th className="table-th">批次</th>
                <th className="table-th">状态</th>
                <th className="table-th">资源</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="table-td">
                    <div className="font-medium font-mono text-sm">{s.sku}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{s.id}</div>
                  </td>
                  <td className="table-td">
                    <div>{s.modelName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{s.serial}</div>
                  </td>
                  <td className="table-td">
                    <span className="chip chip-blue">
                      {FAMILY_LABEL[s.family] ?? s.family}
                    </span>
                  </td>
                  <td className="table-td text-sm">{s.capacity}</td>
                  <td className="table-td text-sm">{s.voltage}</td>
                  <td className="table-td text-xs font-mono">
                    {s.batchId ? (
                      <Link
                        href={`/admin/sku-resources?batch=${s.batchId}`}
                        className="text-matoo hover:underline"
                      >
                        {s.batch}
                      </Link>
                    ) : (
                      s.batch
                    )}
                  </td>
                  <td className="table-td">
                    {s.activated ? (
                      <span className="chip chip-green">{dict.skuList.activated}</span>
                    ) : (
                      <span className="chip chip-gray">{dict.skuList.notActivated}</span>
                    )}
                  </td>
                  <td className="table-td">
                    <Link
                      href={`/admin/sku-resources?sku=${s.id}`}
                      className="text-xs text-matoo hover:underline"
                    >
                      {dict.skuList.openResources}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
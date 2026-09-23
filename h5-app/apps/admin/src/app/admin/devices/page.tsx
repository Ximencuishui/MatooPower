// Admin 设备管理（桌面端表格）—— 仅读取 + 详情 Drawer
'use client';

import { useEffect, useState } from 'react';
import { listAdminDevices, type AdminDeviceItem } from '@/lib/api/operations';
import { useRequireRole, RoleGuardView } from '@/lib/useRequireRole';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { DeviceDetailDrawer } from '@/components/drawers/DeviceDetailDrawer';
import { useLocale } from '@/lib/useLocale';
import { getDict } from '@/lib/i18n';

export default function AdminDevicesPage() {
  const guard = useRequireRole(['admin']);
  const { locale } = useLocale();
  const dict = getDict(locale);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [items, setItems] = useState<AdminDeviceItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (guard.status !== 'ok') return;
    const ac = new AbortController();
    setError(null);
    listAdminDevices({ q: debounced.trim() || undefined, pageSize: 200 }, ac.signal)
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

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title={dict.devices.title} />;
  }

  return (
    <div className="px-8 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{dict.devices.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {dict.devices.subtitle.replace('{total}', String(total))}
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
          placeholder={dict.devices.search}
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
                <th className="table-th">设备 ID</th>
                <th className="table-th">SKU / 序列号</th>
                <th className="table-th">用户</th>
                <th className="table-th">SOH</th>
                <th className="table-th">SOC</th>
                <th className="table-th">循环</th>
                <th className="table-th">告警</th>
                <th className="table-th">最近上报</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr
                  key={d.id}
                  className="hover:bg-slate-50/60 cursor-pointer"
                  onClick={() => setOpenId(d.id)}
                >
                  <td className="table-td font-mono text-xs">{d.id}</td>
                  <td className="table-td">
                    <div className="font-mono text-xs">{d.s_sku ?? d.skuId}</div>
                    {d.s_serial && (
                      <div className="text-[10px] text-slate-500 font-mono">{d.s_serial}</div>
                    )}
                  </td>
                  <td className="table-td">
                    <div className="text-sm">
                      {d.user_displayName ?? d.user_phone ?? d.userId}
                    </div>
                    {d.user_phone && (
                      <div className="text-[10px] text-slate-500 font-mono">{d.user_phone}</div>
                    )}
                  </td>
                  <td className="table-td">
                    <span
                      className={`chip ${
                        d.soh === null
                          ? 'chip-gray'
                          : d.soh >= 80
                            ? 'chip-green'
                            : d.soh >= 60
                              ? 'chip-orange'
                              : 'chip-red'
                      }`}
                    >
                      {d.soh ?? '—'}%
                    </span>
                  </td>
                  <td className="table-td text-sm">{d.soc ?? '—'}%</td>
                  <td className="table-td text-sm">{d.cycles ?? '—'}</td>
                  <td className="table-td">
                    {d.alarms && d.alarms > 0 ? (
                      <span className="chip chip-red">{d.alarms}</span>
                    ) : (
                      <span className="text-slate-400 text-xs">0</span>
                    )}
                  </td>
                  <td className="table-td text-xs text-slate-500">
                    {new Date(d.lastSeenAt).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DeviceDetailDrawer
        deviceId={openId}
        open={!!openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
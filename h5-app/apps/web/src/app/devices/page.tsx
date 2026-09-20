'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TabBar } from '@/components/TabBar';
import { useT } from '@/lib/i18n';
import { listMyDevices } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import type { DeviceDto } from '@/lib/api/endpoints';

export default function DevicesPage() {
  const { t } = useT();
  const [items, setItems] = useState<DeviceDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyDevices()
      .then((r) => setItems(r.items))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          setError(t.devices.needLogin);
        } else {
          setError(e instanceof Error ? e.message : t.common.networkErr);
        }
      });
  }, [t.common.networkErr, t.devices.needLogin]);

  return (
    <PhoneShell>
      <header className="topbar">
        <h1 className="text-[15px] font-semibold">{t.devices.title}</h1>
        <Link href="/scan/MATO-MAT12200-DEMO0001" className="text-matoo text-sm font-medium">{t.devices.scanBtn}</Link>
      </header>

      <main className="flex-1 overflow-auto p-4 space-y-3">
        <Link href="/devices/compare" className="card p-3 flex items-center justify-between bg-gradient-to-br from-matoo-light to-white">
          <div>
            <div className="text-sm font-semibold">📊 {t.devices.compareTitle}</div>
            <div className="text-[11px] text-slate-500">{t.devices.compareHint}</div>
          </div>
          <span className="text-matoo text-sm" aria-hidden="true">›</span>
        </Link>

        {error && (
          <div role="alert" className="card p-4 text-sm text-red-600 bg-red-50">
            {error}
            <div className="mt-2">
              <Link href="/auth?next=/devices" className="text-matoo underline">{t.devices.goLogin}</Link>
            </div>
          </div>
        )}

        {!error && items === null && (
          <div className="text-center text-slate-400 text-sm py-8">{t.scan.loadingHint}</div>
        )}

        {!error && items && items.length === 0 && (
          <div className="card p-8 text-center text-slate-500">{t.devices.empty}</div>
        )}

        {!error && items && items.map((d) => (
          <Link key={d.id} href={`/device/${d.id}`} className="card p-4 block">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-xl bg-matoo-light flex items-center justify-center text-matoo font-bold text-lg">M</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{d.s_modelName ?? d.skuId}</div>
                <div className="text-xs text-slate-500 font-mono">{d.s_serial ?? d.skuId}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="chip chip-green" role="status">{t.devices.bound}</span>
                  <span className="chip chip-gray">{t.device.fw}: {d.fw ?? 'unknown'}</span>
                </div>
              </div>
              <span className="text-slate-400" aria-hidden="true">›</span>
            </div>
          </Link>
        ))}
      </main>

      <TabBar />
    </PhoneShell>
  );
}
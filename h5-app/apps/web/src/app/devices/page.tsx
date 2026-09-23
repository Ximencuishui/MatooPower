'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TabBar } from '@/components/TabBar';
import { PageLoading } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { useT } from '@/lib/i18n';
import { listMyDevices } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { useAbortedFetch } from '@/hooks/useAbortedFetch';
import type { DeviceDto } from '@/lib/api/endpoints';

type StatusFilter = 'all' | 'bound' | 'online';

export default function DevicesPage() {
  const { t } = useT();
  const [items, setItems] = useState<DeviceDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  // P0 UX-10:onRetry 时递增 reloadKey 触发重新 fetch
  const [reloadKey, setReloadKey] = useState(0);

  function load() {
    setError(null);
    setReloadKey((k) => k + 1);
  }

  // P0 UX-10:用 useAbortedFetch 取代裸 useEffect+load,组件卸载或 reload 时取消
  useAbortedFetch((signal) => {
    setError(null);
    listMyDevices({ signal })
      .then((r) => setItems(r.items))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
  }, [reloadKey]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter((d) => {
      if (q) {
        const hit =
          (d.s_modelName ?? '').toLowerCase().includes(q) ||
          (d.s_serial ?? '').toLowerCase().includes(q) ||
          (d.skuId ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      // 注意:'online' 字段后端 health 接口才有,/device/mine 没返回,演示期仅按 bound 过滤
      if (filter === 'bound' && !d.fw) return false;
      return true;
    });
  }, [items, search, filter]);

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
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.devices.compareHint}</div>
          </div>
          <span className="text-matoo text-sm" aria-hidden="true">›</span>
        </Link>

        {/* P2-9:搜索 + 筛选 */}
        {!error && items && items.length > 0 && (
          <div className="space-y-2">
            <form onSubmit={(e) => e.preventDefault()} className="relative">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索 序列号 / 型号"
                aria-label="search devices"
                dir="auto"
                className="input pr-9"
              />
              <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">⌕</span>
            </form>
            <div role="tablist" className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
              {([
                { k: 'all' as StatusFilter, l: '全部' },
                { k: 'bound' as StatusFilter, l: '已绑定' },
              ]).map((tb) => (
                <button
                  key={tb.k}
                  role="tab"
                  aria-selected={filter === tb.k}
                  onClick={() => setFilter(tb.k)}
                  className={`flex-1 py-1.5 rounded-lg ${filter === tb.k ? 'bg-white dark:bg-slate-800 shadow-sm font-semibold' : 'text-slate-500'}`}
                >
                  {tb.l}
                </button>
              ))}
            </div>
          </div>
        )}

        {error != null && <ErrorBlock error={error} onRetry={load} showLoginLink={error instanceof ApiError && error.status === 401} loginNext="/devices" />}

        {!error && items === null && <PageLoading />}

        {!error && items && items.length === 0 && (
          <EmptyState
            icon="📱"
            title={t.devices.empty}
            ctaLabel={t.devices.scanBtn}
            ctaHref="/scan/MATO-MAT12200-DEMO0001"
          />
        )}

        {!error && items && items.length > 0 && filtered.length === 0 && (
          <EmptyState icon="🔍" title="没有匹配的设备" hint="试试其他关键字或清除筛选" />
        )}

        {!error && filtered.map((d) => (
          <Link key={d.id} href={`/device/${d.id}`} className="card p-4 block">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-xl bg-matoo-light flex items-center justify-center text-matoo font-bold text-lg">M</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" title={d.s_modelName ?? d.skuId}>{d.s_modelName ?? d.skuId}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{d.s_serial ?? d.skuId}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="chip chip-green" role="status">{t.devices.bound}</span>
                  <span className="chip chip-gray">{t.device.fw}: {d.fw ?? 'unknown'}</span>
                </div>
              </div>
              <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">›</span>
            </div>
          </Link>
        ))}
      </main>

      <TabBar />
    </PhoneShell>
  );
}
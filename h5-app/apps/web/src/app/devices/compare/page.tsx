'use client';
// P1-1:从 /device/mine 拉真实设备列表进行对比
import { useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { PageLoading } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { useT } from '@/lib/i18n';
import { listMyDevices } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { useAbortedFetch } from '@/hooks/useAbortedFetch';
import type { DeviceDto } from '@/lib/api/endpoints';

type Direction = 'high-good' | 'low-good';
type MetricKey = 'soh' | 'soc' | 'cycles' | 'temp' | 'volt' | 'curr' | 'fw';
type Metric = { key: MetricKey; dir: Direction; suffix?: string; pick: (d: DeviceDto) => number };

function parseFw(s?: string) {
  const m = /v(\d+)\.(\d+)\.(\d+)/.exec(s ?? '');
  if (!m) return 0;
  return (parseInt(m[1] ?? '0', 10) * 10000) + (parseInt(m[2] ?? '0', 10) * 100) + parseInt(m[3] ?? '0', 10);
}

const METRIC_DEFS: Metric[] = [
  { key: 'soh',    dir: 'high-good', suffix: '%', pick: (d) => d.soh ?? 0 },
  { key: 'soc',    dir: 'high-good', suffix: '%', pick: (d) => d.soc ?? 0 },
  { key: 'cycles', dir: 'low-good',  pick: (d) => d.cycles ?? 0 },
  { key: 'temp',   dir: 'low-good',  suffix: '°C', pick: (d) => d.temp ?? 0 },
  { key: 'volt',   dir: 'high-good', suffix: ' V', pick: (d) => d.volt ?? 0 },
  { key: 'curr',   dir: 'low-good',  suffix: ' A', pick: (d) => d.curr ?? 0 },
  { key: 'fw',     dir: 'high-good', pick: (d) => parseFw(d.fw) },
];

export default function ComparePage() {
  const { t } = useT();
  const [items, setItems] = useState<DeviceDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [leftId, setLeftId] = useState<string | undefined>(undefined);
  const [rightId, setRightId] = useState<string | undefined>(undefined);
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
      .then((r) => {
        setItems(r.items);
        if (r.items.length >= 1) setLeftId(r.items[0]?.id);
        if (r.items.length >= 2) setRightId(r.items[1]?.id);
      })
      .catch((e) => {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setError(e);
      });
  }, [reloadKey]);

  if (error) {
    return (
      <PhoneShell>
        <TopBar title={t.compare.title} />
        <main className="p-4"><ErrorBlock error={error} onRetry={load} showLoginLink={error instanceof ApiError && error.status === 401} loginNext="/devices/compare" /></main>
      </PhoneShell>
    );
  }

  if (!items) {
    return (
      <PhoneShell>
        <TopBar title={t.compare.title} />
        <main className="p-5"><PageLoading /></main>
      </PhoneShell>
    );
  }

  if (items.length < 2 || !leftId || !rightId) {
    return (
      <PhoneShell>
        <TopBar title={t.compare.title} />
        <main className="p-4">
          <EmptyState icon="??" title={t.compare.emptyHint} hint="需要至少 2 台设备" />
        </main>
      </PhoneShell>
    );
  }

  const left = items.find((d) => d.id === leftId)!;
  const right = items.find((d) => d.id === rightId)!;

  return (
    <PhoneShell>
      <TopBar title={t.compare.title} right={<span className="text-xs text-slate-400 dark:text-slate-500">{t.compare.picked.replace('{n}', '2')}</span>} />
      <main className="flex-1 overflow-auto pb-6">
        {/* 设备选择条 */}
        <div className="p-4 grid grid-cols-2 gap-3">
          {[
            { side: 'left' as const, id: leftId, setId: setLeftId, label: t.compare.sideLeft, device: left },
            { side: 'right' as const, id: rightId, setId: setRightId, label: t.compare.sideRight, device: right },
          ].map(({ side, id, setId, label, device }) => (
            <div key={side} className="card p-3">
              <label htmlFor={`cmp-${side}`} className="text-[11px] text-slate-500 dark:text-slate-400">{label}</label>
              <select
                id={`cmp-${side}`}
                value={id}
                onChange={(e) => setId(e.target.value)}
                aria-label={`${label}`}
                className="w-full text-sm bg-transparent mt-1 outline-none font-medium"
              >
                {items.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.s_serial ?? d.skuId}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={device.s_modelName ?? device.skuId}>{device.s_modelName ?? device.skuId}</div>
            </div>
          ))}
        </div>

        {/* 头部视觉 */}
        <div className="px-4 grid grid-cols-2 gap-3">
          {[left, right].map((d, i) => (
            <div key={i} className="card p-3 bg-gradient-to-br from-matoo-light to-white">
              <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 text-matoo flex items-center justify-center font-bold">M</div>
              <div className="mt-2 text-sm font-semibold truncate" title={d.s_modelName ?? d.skuId}>{d.s_modelName ?? d.skuId}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{d.s_serial ?? d.skuId}</div>
            </div>
          ))}
        </div>

        {/* 指标对比表 */}
        <div className="px-4 mt-4">
          <div className="card overflow-hidden">
            <div className="grid grid-cols-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40">
              <div className="px-3 py-2 font-medium">{t.compare.metric}</div>
              <div className="px-3 py-2 text-center">L</div>
              <div className="px-3 py-2 text-center">R</div>
            </div>
            {METRIC_DEFS.map((m) => {
              const a = m.pick(left);
              const b = m.pick(right);
              let aCls = '', bCls = '';
              if (a !== b) {
                const aWin = m.dir === 'high-good' ? a > b : a < b;
                if (aWin) aCls = 'text-matoo-dark font-semibold';
                else bCls = 'text-matoo-dark font-semibold';
              }
              return (
                <div key={m.key} className="grid grid-cols-3 text-sm border-t border-slate-100 dark:border-slate-700">
                  <div className="px-3 py-3">
                    <div className="font-medium">{t.compare[`label_${m.key}` as keyof typeof t.compare] as string}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">
                      {m.dir === 'high-good' ? t.compare.dirHigh : t.compare.dirLow}
                    </div>
                  </div>
                  <div className={`px-3 py-3 text-center ${aCls}`}>
                    {m.key === 'fw' ? left.fw ?? '—' : `${a}${m.suffix ?? ''}`}
                    {aCls && <span aria-label={t.compare.best}><span aria-hidden="true"> ★</span><span className="ml-1 text-[10px]">{t.compare.best}</span></span>}
                  </div>
                  <div className={`px-3 py-3 text-center ${bCls}`}>
                    {m.key === 'fw' ? right.fw ?? '—' : `${b}${m.suffix ?? ''}`}
                    {bCls && <span aria-label={t.compare.best}><span aria-hidden="true"> ★</span><span className="ml-1 text-[10px]">{t.compare.best}</span></span>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">{t.compare.rule}</p>
        </div>

        <div className="px-4 mt-4 grid grid-cols-2 gap-3">
          <Link href={`/device/${left.id}`} className="btn-secondary">{t.compare.detailLeft}</Link>
          <Link href={`/device/${right.id}`} className="btn-secondary">{t.compare.detailRight}</Link>
        </div>
      </main>
    </PhoneShell>
  );
}
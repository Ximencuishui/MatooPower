'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { useT } from '@/lib/i18n';
import { DEMO_DEVICES } from '@/data/mock';

// 比较规则：返回 'high-good' / 'low-good'
type Direction = 'high-good' | 'low-good';
type MetricKey = 'soh' | 'soc' | 'cycles' | 'temp' | 'volt' | 'alarms' | 'fw';
type Metric = { key: MetricKey; dir: Direction; suffix?: string; pick: (d: any) => number };

function parseFw(s: string) {
  const m = /v(\d+)\.(\d+)\.(\d+)/.exec(s);
  if (!m) return 0;
  const major = parseInt(m[1] ?? '0', 10);
  const minor = parseInt(m[2] ?? '0', 10);
  const patch = parseInt(m[3] ?? '0', 10);
  return major * 10000 + minor * 100 + patch;
}

const METRIC_DEFS: Metric[] = [
  { key: 'soh',    dir: 'high-good', suffix: '%', pick: (d) => d.soh },
  { key: 'soc',    dir: 'high-good', suffix: '%', pick: (d) => d.soc },
  { key: 'cycles', dir: 'low-good',  pick: (d) => d.cycles },
  { key: 'temp',   dir: 'low-good',  suffix: '°C', pick: (d) => d.temp },
  { key: 'volt',   dir: 'high-good', suffix: ' V', pick: (d) => d.volt },
  { key: 'alarms', dir: 'low-good',  pick: (d) => d.alarms },
  { key: 'fw',     dir: 'high-good', pick: (d) => parseFw(d.fw) },
];

export default function ComparePage() {
  const { t } = useT();
  const bound = DEMO_DEVICES.filter((d) => d.bound);
  const [leftId, setLeftId] = useState<string | undefined>(bound[0]?.id);
  const [rightId, setRightId] = useState<string | undefined>(bound[1]?.id);

  if (bound.length < 2 || !leftId || !rightId) {
    return (
      <PhoneShell>
        <TopBar title={t.compare.title} />
        <main className="p-5 text-sm text-slate-500">{t.compare.emptyHint}</main>
      </PhoneShell>
    );
  }

  const left = DEMO_DEVICES.find((d) => d.id === leftId);
  const right = DEMO_DEVICES.find((d) => d.id === rightId);
  if (!left || !right) {
    return (
      <PhoneShell>
        <TopBar title={t.compare.title} />
        <main className="p-5 text-sm text-slate-500">{t.compare.emptyHint}</main>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <TopBar title={t.compare.title} right={<span className="text-xs text-slate-400">{t.compare.picked.replace('{n}', '2')}</span>} />
      <main className="flex-1 overflow-auto pb-6">
        {/* 设备选择条 */}
        <div className="p-4 grid grid-cols-2 gap-3">
          {[
            { side: 'left' as const, id: leftId, setId: setLeftId, label: t.compare.sideLeft, device: left },
            { side: 'right' as const, id: rightId, setId: setRightId, label: t.compare.sideRight, device: right },
          ].map(({ side, id, setId, label, device }) => (
            <div key={side} className="card p-3">
              <label htmlFor={`cmp-${side}`} className="text-[11px] text-slate-500">{label}</label>
              <select
                id={`cmp-${side}`}
                value={id}
                onChange={(e) => setId(e.target.value)}
                aria-label={`${label} - ${device.product}`}
                className="w-full text-sm bg-transparent mt-1 outline-none font-medium"
              >
                {bound.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.serial}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-slate-500 truncate">{device.product}</div>
            </div>
          ))}
        </div>

        {/* 头部视觉 */}
        <div className="px-4 grid grid-cols-2 gap-3">
          {[left, right].map((d, i) => (
            <div key={i} className="card p-3 bg-gradient-to-br from-matoo-light to-white">
              <div className="w-10 h-10 rounded-lg bg-white text-matoo flex items-center justify-center font-bold">M</div>
              <div className="mt-2 text-sm font-semibold truncate">{d.product}</div>
              <div className="text-[11px] text-slate-500 font-mono">{d.serial}</div>
              <div className="mt-2 text-[11px]">
                <span className="chip chip-green" role="status">{t.warranty.statusActive} · {d.warrantyEnd}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 指标对比表 */}
        <div className="px-4 mt-4">
          <div className="card overflow-hidden">
            <div className="grid grid-cols-3 text-xs text-slate-500 bg-slate-50">
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
              const aBad = m.dir === 'high-good' ? a < b : a > b;
              const bBad = m.dir === 'high-good' ? b < a : b > a;
              const showBadA = aBad && a !== b;
              const showBadB = bBad && a !== b;
              return (
                <div key={m.key} className="grid grid-cols-3 text-sm border-t border-slate-100">
                  <div className="px-3 py-3">
                    <div className="font-medium">{t.compare[`label_${m.key}` as keyof typeof t.compare] as string}</div>
                    <div className="text-[10px] text-slate-400">
                      {m.dir === 'high-good' ? t.compare.dirHigh : t.compare.dirLow}
                    </div>
                  </div>
                  <div className={`px-3 py-3 text-center ${aCls}`}>
                    {m.key === 'fw' ? left.fw : `${a}${m.suffix ?? ''}`}
                    {aCls && <span aria-label={t.compare.best}><span aria-hidden="true"> ★</span><span className="ml-1 text-[10px]">{t.compare.best}</span></span>}
                    {showBadA && <span aria-label={t.compare.worst}><span aria-hidden="true"> !</span><span className="ml-1 text-[10px] text-red-500">{t.compare.worst}</span></span>}
                  </div>
                  <div className={`px-3 py-3 text-center ${bCls}`}>
                    {m.key === 'fw' ? right.fw : `${b}${m.suffix ?? ''}`}
                    {bCls && <span aria-label={t.compare.best}><span aria-hidden="true"> ★</span><span className="ml-1 text-[10px]">{t.compare.best}</span></span>}
                    {showBadB && <span aria-label={t.compare.worst}><span aria-hidden="true"> !</span><span className="ml-1 text-[10px] text-red-500">{t.compare.worst}</span></span>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-3">{t.compare.rule}</p>
        </div>

        {/* 建议 */}
        <div className="px-4 mt-4">
          <div className="card p-3 bg-amber-50 text-amber-800 text-xs" role="status">
            <div className="font-semibold mb-1">⚠ {t.compare.healthTitle}</div>
            {(left.temp ?? 0) > 28 ? t.compare.tipTempHighLeft : ''}
            {(right.cycles ?? 0) > 1000 ? t.compare.tipCyclesHighRight : ''}
            {((left.temp ?? 0) <= 28 && (right.cycles ?? 0) <= 1000) ? t.compare.tipOk : ''}
          </div>
        </div>

        <div className="px-4 mt-4 grid grid-cols-2 gap-3">
          <Link href={`/device/${left.skuId}`} className="btn-secondary">{t.compare.detailLeft}</Link>
          <Link href={`/device/${right.skuId}`} className="btn-secondary">{t.compare.detailRight}</Link>
        </div>
      </main>
    </PhoneShell>
  );
}
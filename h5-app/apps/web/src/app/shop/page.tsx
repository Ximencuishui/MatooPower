'use client';
import { useEffect, useState } from 'react';
import { PhoneShell } from '@/components/PhoneShell';
import { TabBar } from '@/components/TabBar';
import { useT } from '@/lib/i18n';
import { getDeviceHealth } from '@/lib/api/operations';
import { toast } from '@/components/Toast';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';

type PartCategory = 'connector' | 'monitor' | 'protection' | 'solar';
type Part = {
  id: string;
  name: string;
  category: PartCategory;
  price: number;
  img: string;
  compatibleSkus: string[];
  description: string;
};

const PARTS: Part[] = [
  { id: 'p-1', name: 'XT90 高电流连接线', category: 'connector', price: 18, img: '??', compatibleSkus: ['MATO-MAT12200-DEMO0001','MATO-MAT12200-DEMO0002','MATO-MAT12200-DEMO0003','MATO-MAT12300-DEMO0004'], description: '50A 持续电流,含防反插护套' },
  { id: 'p-2', name: 'Anderson 50A 插头', category: 'connector', price: 6, img: '??', compatibleSkus: ['MATO-MAT12200-DEMO0001','MATO-MAT12200-DEMO0002','MATO-MAT12200-DEMO0003'], description: '快速插拔,适合便携场景' },
  { id: 'p-3', name: 'Smart BMS 蓝牙显示器', category: 'monitor', price: 36, img: '??', compatibleSkus: ['MATO-MAT12200-DEMO0001','MATO-MAT12200-DEMO0002','MATO-MAT12200-DEMO0003','MATO-MAT12300-DEMO0004'], description: '实时 SoC / SOH / 告警推送' },
  { id: 'p-4', name: '20A MPPT 太阳能控制器', category: 'solar', price: 52, img: '??', compatibleSkus: ['MATO-MAT12200-DEMO0002','MATO-MAT12300-DEMO0004'], description: '12/24V 自适应,IP65 防水' },
  { id: 'p-5', name: '200W 单晶硅太阳能板', category: 'solar', price: 138, img: '??', compatibleSkus: ['MATO-MAT12300-DEMO0004'], description: '含 MC4 连接器,铝框便携款' },
  { id: 'p-6', name: '定制防水外壳', category: 'protection', price: 24, img: '??', compatibleSkus: ['MATO-MAT12200-DEMO0001','MATO-MAT12200-DEMO0002','MATO-MAT12300-DEMO0004'], description: 'IP67,可定制尺寸' },
  { id: 'p-7', name: '散热风扇模组', category: 'protection', price: 14, img: '??', compatibleSkus: ['MATO-MAT12300-DEMO0004'], description: '12V 静音版,含温控开关' },
];

const CATEGORIES: Array<{ key: PartCategory | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'connector', label: '电源连接' },
  { key: 'monitor', label: '监控扩展' },
  { key: 'solar', label: '绿能外设' },
  { key: 'protection', label: '安装保护' },
];

export default function ShopPage() {
  const { t } = useT();
  const { formatCurrency } = useLocaleFormat();
  const [cat, setCat] = useState<PartCategory | 'all'>('all');
  const [fav, setFav] = useState<Set<string>>(new Set());
  const [activeSku, setActiveSku] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const sku = sp.get('sku');
    if (sku) setActiveSku(sku);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('matoo.fav');
      if (raw) setFav(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  function toggleFav(id: string) {
    setFav((s) => {
      const next = new Set(s);
      const had = next.has(id);
      next.has(id) ? next.delete(id) : next.add(id);
      if (typeof window !== 'undefined') window.localStorage.setItem('matoo.fav', JSON.stringify(Array.from(next)));
      toast(had ? t.shop.unfav : t.shop.fav, 'success');
      return next;
    });
  }

  // P1-3:加购 disabled + tooltip
  function onAddToCart(_p: Part) {
    toast(t.common.comingSoon + ' / Coming soon', 'info');
  }

  const filtered = PARTS.filter((p) => {
    if (cat !== 'all' && p.category !== cat) return false;
    if (activeSku && !p.compatibleSkus.includes(activeSku)) return false;
    return true;
  });

  return (
    <PhoneShell>
      <header className="topbar">
        <h1 className="text-[15px] font-semibold">{t.tabs.shop}</h1>
        <span className="text-xs text-slate-400 dark:text-slate-500">{t.shop.phase}</span>
      </header>

      <main className="flex-1 overflow-auto p-4 space-y-4">
        {activeSku && (
          <div className="card p-3 bg-matoo-light text-matoo-dark text-xs flex items-center justify-between">
            <span>仅显示与 <span className="font-mono font-bold">{activeSku}</span> 兼容的配件</span>
            <button onClick={() => setActiveSku(null)} className="text-matoo-dark underline">{t.shop.clearFilter}</button>
          </div>
        )}

        <div role="tablist" className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              role="tab"
              aria-selected={cat === c.key}
              onClick={() => setCat(c.key)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${
                cat === c.key ? 'bg-matoo text-white font-semibold' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="card p-8 text-center text-slate-500 dark:text-slate-400 text-sm">{t.shop.empty}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((p) => {
            const faved = fav.has(p.id);
            return (
              <div key={p.id} className="card overflow-hidden">
                <div className="h-24 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-4xl relative">
                  {p.img}
                  <button
                    onClick={() => toggleFav(p.id)}
                    aria-label={faved ? t.shop.unfav : t.shop.fav}
                    aria-pressed={faved}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 flex items-center justify-center text-sm"
                  >
                    {faved ? '★' : '☆'}
                  </button>
                </div>
                <div className="p-3">
                  <div className="text-sm font-medium truncate" title={p.name}>{p.name}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{p.description}</div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-matoo font-bold whitespace-nowrap">{formatCurrency(p.price, 'USD')}</span>
                    <button
                      onClick={() => onAddToCart(p)}
                      title={t.common.comingSoon}
                      disabled
                      className="text-[10px] px-2.5 py-1.5 rounded-md bg-matoo/10 dark:bg-matoo/20 text-matoo font-medium border border-matoo/30 disabled:opacity-80 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      <span aria-hidden="true">??</span>
                      {t.common.comingSoon}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">{t.shop.footer}</p>
      </main>

      <TabBar />
    </PhoneShell>
  );
}
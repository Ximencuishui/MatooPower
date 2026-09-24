'use client';
// v1.5 #P0-2:配件商城 - 消费后端 GET /parts(替代本地硬编码)
import { useEffect, useState } from 'react';
import { PhoneShell } from '@/components/PhoneShell';
import { TabBar } from '@/components/TabBar';
import { PageLoading, Spinner } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { useT } from '@/lib/i18n';
import { listParts, createPartOrder, type PartItem, type PartOrder } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { toast } from '@/components/Toast';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';

type FamilyKey = PartItem['family'];
type CategoryKey = FamilyKey | 'all';

const CATEGORIES: Array<{ key: CategoryKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'cell', label: '电芯' },
  { key: 'bms', label: 'BMS' },
  { key: 'charger', label: '充电器' },
  { key: 'cable', label: '线缆' },
  { key: 'accessory', label: '配件' },
];

export default function ShopPage() {
  const { t } = useT();
  const { formatCurrency } = useLocaleFormat();
  const [cat, setCat] = useState<CategoryKey>('all');
  const [activeSku, setActiveSku] = useState<string | null>(null);

  const [parts, setParts] = useState<PartItem[] | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [ordering, setOrdering] = useState<string | null>(null);
  const [recentOrder, setRecentOrder] = useState<PartOrder | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const sku = sp.get('sku');
    if (sku) setActiveSku(sku);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const recent = window.localStorage.getItem('matoo.lastPartOrder');
      if (recent) setRecentOrder(JSON.parse(recent));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setParts(null);
      setLoadError(null);
      try {
        const r = await listParts({ family: cat === 'all' ? undefined : cat });
        if (!cancelled) setParts(r.items);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e : new Error(String(e)));
      }
    })();
    return () => { cancelled = true; };
  }, [cat, reloadKey]);

  function load() {
    setReloadKey((k) => k + 1);
  }

  async function onAddToCart(p: PartItem) {
    if (ordering) return;
    if (p.stock <= 0) { toast('该配件暂无库存', 'error'); return; }
    setOrdering(p.id);
    try {
      const r = await createPartOrder({
        items: [{ partId: p.id, quantity: 1 }],
        source: 'h5',
      });
      setRecentOrder(r.order);
      try { window.localStorage.setItem('matoo.lastPartOrder', JSON.stringify(r.order)); } catch { /* */ }
      toast(`下单成功 ${p.name} ✓ 订单号 ${r.orderId}`, 'success');
      // 刷新库存
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
      else toast('下单失败,请稍后重试', 'error');
    } finally {
      setOrdering(null);
    }
  }

  const filtered = (parts ?? []).filter((p) => {
    if (cat !== 'all' && p.family !== cat) return false;
    if (activeSku && p.compatibleSkus && !p.compatibleSkus.includes(activeSku)) return false;
    return true;
  });

  const isLoading = parts === null && !loadError;

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

        {recentOrder && (
          <div className="card p-3 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/30 text-xs">
            <div className="text-emerald-700 dark:text-emerald-300 font-medium">最近订单</div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
              订单号 <span className="font-mono">{recentOrder.id}</span> · 状态 {recentOrder.status} · 总额 {formatCurrency(recentOrder.totalCents / 100, recentOrder.currency)}
            </div>
          </div>
        )}

        {loadError && <ErrorBlock error={loadError} onRetry={load} />}
        {isLoading && <PageLoading />}

        {!isLoading && !loadError && filtered.length === 0 && (
          <div className="card p-8 text-center text-slate-500 dark:text-slate-400 text-sm">{t.shop.empty}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {filtered.map((p) => {
            const outOfStock = p.stock <= 0 || !p.active;
            const isOrdering = ordering === p.id;
            return (
              <div key={p.id} className="card overflow-hidden">
                <div className="h-24 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center text-4xl relative">
                  {p.imageUrls?.[0] ? (
                    <img src={p.imageUrls[0]} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <span aria-hidden="true">📦</span>
                  )}
                  {outOfStock && (
                    <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 bg-slate-700 text-white rounded">暂无库存</span>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-sm font-medium truncate" title={p.name}>{p.name}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{p.description ?? '—'}</div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-matoo font-bold whitespace-nowrap">{formatCurrency(p.priceCents / 100, p.currency)}</span>
                    <button
                      onClick={() => onAddToCart(p)}
                      disabled={outOfStock || isOrdering}
                      className="text-[10px] px-2.5 py-1.5 rounded-md bg-matoo text-white font-medium hover:bg-matoo-dark disabled:opacity-60 inline-flex items-center gap-1"
                    >
                      {isOrdering ? <Spinner size="sm" /> : null}
                      {isOrdering ? '处理中' : '下单'}
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
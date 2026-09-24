'use client';
// v1.5 #P1-9:经销商专属价表 - 消费 GET /dealer/price-list(后端反查 DealerPriceList + Sku)
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar, DealerBreadcrumb } from '@/components/TopBar';
import { LangSwitch } from '@/components/LangSwitch';
import { EmptyState } from '@/components/EmptyState';
import { PageLoading, Spinner } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { useT } from '@/lib/i18n';
import { useRequireRole, RoleGuardView } from '@/hooks/useRequireRole';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { getDealerPriceList, type DealerPriceRow } from '@/lib/api/operations';

function parseImages(json: string | null): string[] {
  if (!json) return [];
  try { const a = JSON.parse(json); return Array.isArray(a) ? a : []; } catch { return []; }
}

export default function DealerPriceListPage() {
  const { t } = useT();
  const { formatCurrency, formatDate } = useLocaleFormat();
  const guard = useRequireRole(['dealer', 'admin']);

  const [rows, setRows] = useState<DealerPriceRow[] | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (guard.status !== 'ok') return;
    let cancelled = false;
    (async () => {
      setRows(null);
      setLoadError(null);
      try {
        const r = await getDealerPriceList();
        if (!cancelled) setRows(r.items);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e : new Error(String(e)));
      }
    })();
    return () => { cancelled = true; };
  }, [guard.status, reloadKey]);

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title="专属价表" />;
  }

  return (
    <PhoneShell>
      <TopBar title="专属价表" leftExtra={<DealerBreadcrumb />} right={<LangSwitch />} />
      <main className="flex-1 overflow-auto p-4 space-y-4">
        <div className="card p-3 bg-matoo-light text-matoo-dark text-xs">
          以下为本账号关联经销商享有的 SKU 专属价(由 admin 在 dealer 后台配置);价格含 ISO 4217 货币单位,有效期涵盖今天。
        </div>

        {loadError && <ErrorBlock error={loadError} onRetry={() => setReloadKey((k) => k + 1)} />}
        {!loadError && rows === null && <PageLoading />}
        {!loadError && rows && rows.length === 0 && (
          <EmptyState icon="🏷️" title="暂未配置专属价" hint="请联系 admin 在『经销商 → 价表』中添加" />
        )}

        <div className="space-y-2">
          {rows && rows.map((r) => {
            const imgs = parseImages(r.imageUrls);
            const guide = r.guidePriceCents ?? null;
            const savings = guide && guide > r.priceCents ? Math.round((1 - r.priceCents / guide) * 100) : null;
            return (
              <article key={r.id} className="card p-3 flex gap-3">
                <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {imgs[0] ? (
                    <img src={imgs[0]} alt={r.modelName} className="w-full h-full object-cover" />
                  ) : (
                    <span aria-hidden="true">🔋</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" title={r.modelName}>{r.modelName}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{r.sku} · SN {r.serial}</div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className="text-matoo font-bold">{formatCurrency(r.priceCents / 100, r.currency)}</div>
                      {guide && guide !== r.priceCents && (
                        <div className="text-[10px] text-slate-400 line-through">
                          {formatCurrency(guide / 100, r.guidePriceCurrency ?? r.currency)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-[10px] text-slate-500">
                      生效 {formatDate(r.effectiveFrom)}{r.effectiveTo ? ` ~ ${formatDate(r.effectiveTo)}` : ' 起长期有效'}
                    </div>
                    {savings != null && savings > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold">
                        省 {savings}%
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-2">
          价表由 admin 在 <code className="font-mono">/admin/dealers</code> 中维护
        </p>
      </main>
    </PhoneShell>
  );
}
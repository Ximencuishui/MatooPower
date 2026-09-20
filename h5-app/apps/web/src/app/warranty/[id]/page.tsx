'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { useT } from '@/lib/i18n';
import { SKU_DB } from '@/data/mock';

export default function WarrantyPage() {
  const params = useParams<{ id: string }>();
  const { t } = useT();
  const sku = SKU_DB[decodeURIComponent(params.id)];
  if (!sku) return <PhoneShell><TopBar title="Not found" /><main className="p-5">SKU not found.</main></PhoneShell>;

  // 演示：根据发票日 2025-01-15 + 整机 36 月计算截止
  const start = '2025-01-15';
  const endWhole = '2028-01-15';
  const endCell = '2030-01-15';
  const endBms = '2028-01-15';
  const endParts = '2026-01-15';

  return (
    <PhoneShell>
      <TopBar title={t.warranty.card} />
      <main className="flex-1 overflow-auto pb-6">
        {/* 卡片视觉 */}
        <section className="px-4 pt-2">
          <div className="rounded-2xl p-5 text-white shadow-card" style={{
            background: 'linear-gradient(135deg,#0E8F5A 0%,#0A6E45 100%)'
          }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs opacity-80">{t.warranty.statusActive}</div>
                <div className="text-lg font-bold mt-1">{sku.modelName}</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center font-bold">M</div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-y-3 text-sm">
              <div>
                <div className="text-[11px] opacity-70">{t.warranty.serial}</div>
                <div className="font-mono">{sku.serial}</div>
              </div>
              <div>
                <div className="text-[11px] opacity-70">{t.warranty.startAt}</div>
                <div>{start}</div>
              </div>
              <div>
                <div className="text-[11px] opacity-70">{t.warranty.endAt}</div>
                <div>{endWhole}</div>
              </div>
              <div>
                <div className="text-[11px] opacity-70">{t.warranty.dealer}</div>
                <div>Dhaka Power Hub</div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between text-xs opacity-80">
              <span>Matoo Power Service</span>
              <span>app.matoopower.com</span>
            </div>
          </div>
        </section>

        {/* 保修期明细 */}
        <section className="px-4 mt-4">
          <h3 className="font-semibold mb-2">{t.warranty.coverages}</h3>
          <div className="card divide-y">
            {[
              { k: 'cov_whole', m: 36, end: endWhole },
              { k: 'cov_cell', m: 60, end: endCell },
              { k: 'cov_bms', m: 36, end: endBms },
              { k: 'cov_parts', m: 12, end: endParts },
            ].map((c, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-medium">{t.warranty[c.k as keyof typeof t.warranty]}</div>
                  <div className="text-xs text-slate-500">{c.m} months</div>
                </div>
                <div className="text-sm text-slate-600">→ {c.end}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="px-4 mt-4 grid grid-cols-2 gap-3">
          <button className="card p-3 text-sm font-medium">{t.warranty.download}</button>
          <button className="card p-3 text-sm font-medium">{t.warranty.share}</button>
        </section>

        <section className="px-4 mt-4">
          <Link href={`/device/${sku.id}`} className="btn-secondary">{t.warranty.viewDevice}</Link>
        </section>
      </main>
    </PhoneShell>
  );
}
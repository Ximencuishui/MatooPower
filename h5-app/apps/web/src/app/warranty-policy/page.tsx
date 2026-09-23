'use client';
// 保修政策详情页(P2-7):激活页第 1 步 ? 图标跳转

import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { useT } from '@/lib/i18n';

export default function WarrantyPolicyPage() {
  const { t } = useT();
  return (
    <PhoneShell>
      <TopBar title={t.legal.termsTitle} />
      <main className="flex-1 overflow-auto p-4">
        <h1 className="text-lg font-bold mb-3">{t.legal.termsSection2Title}</h1>
        <div className="text-sm text-slate-700 dark:text-slate-300 space-y-4 leading-relaxed">
          <p>{t.legal.termsSection2}</p>

          <section className="card p-4 space-y-3">
            <h2 className="font-semibold">A · 发票日优先</h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              提供有效发票时,保修期自发票日期起算;发票日期早于出厂日的,以出厂日起算。
            </p>
            <h2 className="font-semibold">B · MFG + 60 天兜底</h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              无发票或发票缺失时,保修期按出厂日 + 60 天宽限起算。
            </p>
            <h2 className="font-semibold">C · 不同部件保修期</h2>
            <ul className="text-xs text-slate-600 dark:text-slate-300 list-disc list-inside space-y-1">
              <li>整机(Whole unit):36 个月</li>
              <li>电芯(Cells):60 个月</li>
              <li>BMS:36 个月</li>
              <li>配件(Parts):12 个月</li>
            </ul>
          </section>

          <p className="text-[11px] text-slate-400 dark:text-slate-500">{t.legal.demoNote}</p>
        </div>
      </main>
    </PhoneShell>
  );
}
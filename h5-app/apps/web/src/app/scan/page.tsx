'use client';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { useT } from '@/lib/i18n';

export default function ScanEntry() {
  const { t } = useT();
  return (
    <PhoneShell>
      <TopBar title={t.scanEntry.title} />
      <main className="flex-1 overflow-auto p-5 flex flex-col">
        <div className="w-56 h-56 mt-2 border-2 border-dashed border-matoo rounded-2xl flex items-center justify-center text-matoo relative overflow-hidden mx-auto">
          {[
            'top-2 left-2 border-t-4 border-l-4',
            'top-2 right-2 border-t-4 border-r-4',
            'bottom-2 left-2 border-b-4 border-l-4',
            'bottom-2 right-2 border-b-4 border-r-4',
          ].map((c, i) => (
            <span key={i} className={`absolute w-8 h-8 ${c} rounded-md`} />
          ))}
          <div className="text-center">
            <div aria-hidden="true" className="text-3xl">📷</div>
            <div className="text-xs mt-2 px-2">{t.scanEntry.demoTip}</div>
          </div>
        </div>

        <h3 className="font-semibold text-sm text-slate-600 dark:text-slate-300 mt-6 mb-2">{t.scanEntry.sectionNormal}</h3>
        <Link href="/scan/MATO-MAT12200-DEMO0001" className="btn-primary">{t.scanEntry.demoUnactivated}</Link>
        <Link href="/scan/MATO-MAT12200-DEMO0002" className="btn-secondary mt-3">{t.scanEntry.demoActivated}</Link>

        <h3 className="font-semibold text-sm text-slate-600 dark:text-slate-300 mt-6 mb-2">{t.scanEntry.sectionFail}</h3>
        <Link href="/scan/FAKE-CODE-0000" className="btn-ghost text-red-500">{t.scanEntry.demoFake}</Link>
        <Link href="/scan/REVOKED-CODE-0000" className="btn-ghost text-amber-700">{t.scanEntry.demoRevoked}</Link>
        <Link href="/scan/NETERR-CODE-0000" className="btn-ghost text-slate-600 dark:text-slate-300">{t.scanEntry.demoNetwork}</Link>

        <h3 className="font-semibold text-sm text-slate-600 dark:text-slate-300 mt-6 mb-2">{t.scanEntry.sectionExtra}</h3>
        <Link href="/devices/compare" className="btn-ghost">📊 {t.scanEntry.demoCompare}</Link>
        <Link href="/dealer/batch" className="btn-ghost">🛒 {t.scanEntry.demoDealer}</Link>
      </main>
    </PhoneShell>
  );
}
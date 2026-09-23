'use client';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { useT } from '@/lib/i18n';

export default function TermsPage() {
  const { t } = useT();
  return (
    <PhoneShell>
      <TopBar title={t.legal.termsTitle} />
      <main className="flex-1 overflow-auto p-4">
        <h1 className="text-lg font-bold mb-3">{t.legal.termsTitle}</h1>
        <div className="text-sm text-slate-700 dark:text-slate-300 space-y-3 leading-relaxed">
          <p>{t.legal.termsIntro}</p>
          <h2 className="font-semibold mt-4">{t.legal.termsSection1Title}</h2>
          <p>{t.legal.termsSection1}</p>
          <h2 className="font-semibold mt-4">{t.legal.termsSection2Title}</h2>
          <p>{t.legal.termsSection2}</p>
          <h2 className="font-semibold mt-4">{t.legal.termsSection3Title}</h2>
          <p>{t.legal.termsSection3}</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-6">{t.legal.demoNote}</p>
        </div>
      </main>
    </PhoneShell>
  );
}
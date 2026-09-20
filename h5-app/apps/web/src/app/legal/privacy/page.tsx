'use client';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { useT } from '@/lib/i18n';

export default function PrivacyPage() {
  const { t } = useT();
  return (
    <PhoneShell>
      <TopBar title={t.legal.privacyTitle} />
      <main className="flex-1 overflow-auto p-4">
        <h1 className="text-lg font-bold mb-3">{t.legal.privacyTitle}</h1>
        <div className="text-sm text-slate-700 space-y-3 leading-relaxed">
          <p>{t.legal.privacyIntro}</p>
          <h2 className="font-semibold mt-4">{t.legal.privacySection1Title}</h2>
          <p>{t.legal.privacySection1}</p>
          <h2 className="font-semibold mt-4">{t.legal.privacySection2Title}</h2>
          <p>{t.legal.privacySection2}</p>
          <h2 className="font-semibold mt-4">{t.legal.privacySection3Title}</h2>
          <p>{t.legal.privacySection3}</p>
          <p className="text-[11px] text-slate-400 mt-6">{t.legal.demoNote}</p>
        </div>
      </main>
    </PhoneShell>
  );
}
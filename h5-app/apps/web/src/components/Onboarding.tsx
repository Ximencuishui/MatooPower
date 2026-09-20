'use client';
// 首屏 onboarding:3 步引导,只在首次访问显示(localStorage 标记)
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';

const STORAGE_KEY = 'matoo.onboarded';

export function Onboarding() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const done = window.localStorage.getItem(STORAGE_KEY);
    if (!done) setOpen(true);
  }, []);

  function close() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
    setOpen(false);
  }

  if (!open) return null;

  const steps = [
    {
      icon: '📷',
      title: t.onboarding.step1Title,
      desc: t.onboarding.step1Desc,
    },
    {
      icon: '🛡',
      title: t.onboarding.step2Title,
      desc: t.onboarding.step2Desc,
    },
    {
      icon: '🛒',
      title: t.onboarding.step3Title,
      desc: t.onboarding.step3Desc,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-matoo/95 backdrop-blur-sm flex flex-col items-center justify-center p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm text-center text-white space-y-6">
        <div aria-hidden="true" className="text-7xl">{steps[step]?.icon}</div>
        <h2 className="text-2xl font-bold">{steps[step]?.title}</h2>
        <p className="text-sm opacity-90 leading-relaxed">{steps[step]?.desc}</p>
        <div className="flex justify-center gap-1.5 pt-2">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${i === step ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
        <div className="flex gap-2 pt-4">
          <button
            onClick={close}
            className="flex-1 h-12 rounded-xl border border-white/40 text-white font-medium"
          >
            {t.onboarding.skip}
          </button>
          <button
            onClick={() => (step === steps.length - 1 ? close() : setStep(step + 1))}
            className="flex-1 h-12 rounded-xl bg-white text-matoo-dark font-semibold"
          >
            {step === steps.length - 1 ? t.onboarding.start : t.onboarding.next}
          </button>
        </div>
      </div>
    </div>
  );
}

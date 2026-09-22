'use client';
// 首屏 onboarding:3 步引导,只在首次访问显示(localStorage 标记)
// 可从 profile 页面"重新查看引导"入口重启
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';

const STORAGE_KEY = 'matoo.onboarded';
const RESTART_KEY = 'matoo.onboarded.restart';

export function Onboarding() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const done = window.localStorage.getItem(STORAGE_KEY);
    const restart = window.sessionStorage.getItem(RESTART_KEY);
    if (!done || restart === '1') {
      setOpen(true);
      window.sessionStorage.removeItem(RESTART_KEY);
    }
  }, []);

  function close() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
    setOpen(false);
  }

  if (!open) return null;

  const steps = [
    { icon: '📷', title: t.onboarding.step1Title, desc: t.onboarding.step1Desc },
    { icon: '🛡', title: t.onboarding.step2Title, desc: t.onboarding.step2Desc },
    { icon: '🛒', title: t.onboarding.step3Title, desc: t.onboarding.step3Desc },
  ];

  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-matoo/95 backdrop-blur-sm flex flex-col items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="onboarding">
      <button
        onClick={close}
        aria-label="关闭引导"
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white/80 hover:text-white text-2xl rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        ×
      </button>
      <div className="w-full max-w-sm text-center text-white space-y-6">
        <div aria-hidden="true" className="text-7xl">{steps[step]?.icon}</div>
        <h2 className="text-2xl font-bold">{steps[step]?.title}</h2>
        <p className="text-sm opacity-90 leading-relaxed">{steps[step]?.desc}</p>
        <div className="flex justify-center gap-1.5 pt-2" role="tablist">
          {steps.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={step === i}
              aria-label={`step ${i + 1}`}
              onClick={() => setStep(i)}
              className={`w-2.5 h-2.5 rounded-full transition ${i === step ? 'bg-white dark:bg-slate-800 w-6' : 'bg-white/30 hover:bg-white/50'}`}
            />
          ))}
        </div>
        <div className="flex gap-2 pt-4">
          {!isFirst && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 h-12 rounded-xl border border-white/40 text-white font-medium"
            >
              上一步
            </button>
          )}
          {isFirst && (
            <button onClick={close} className="flex-1 h-12 rounded-xl border border-white/40 text-white font-medium">
              {t.onboarding.skip}
            </button>
          )}
          <button
            onClick={() => (isLast ? close() : setStep(step + 1))}
            className="flex-1 h-12 rounded-xl bg-white dark:bg-slate-800 text-matoo-dark font-semibold"
          >
            {isLast ? t.onboarding.start : t.onboarding.next}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 重新查看引导:从 profile 页面触发,设置 sessionStorage 让 Onboarding 再次打开 */
export function restartOnboarding() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(RESTART_KEY, '1');
}
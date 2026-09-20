'use client';
import { ReactNode, useEffect, useState } from 'react';

export function PhoneShell({ children }: { children: React.ReactNode }) {
  const [isPwa, setIsPwa] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // standalone PWA / iOS 全屏:fake-statusbar 才显示,避免双层状态栏
    const standalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      // @ts-ignore iOS Safari 私有属性
      window.navigator?.standalone === true;
    setIsPwa(Boolean(standalone));
  }, []);

  return (
    <div className="phone-shell">
      <div className={`fake-statusbar ${isPwa ? 'is-pwa' : ''}`}>
        <span>9:41</span>
        <span className="flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-slate-500" />
          <span className="w-1 h-1 rounded-full bg-slate-500" />
          <span className="w-1 h-1 rounded-full bg-slate-500" />
          <span className="ml-2 text-[11px]">100%</span>
        </span>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

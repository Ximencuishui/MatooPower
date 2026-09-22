'use client';
import { ReactNode, useEffect, useState } from 'react';

function formatTime(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export function PhoneShell({ children }: { children: ReactNode }) {
  const [isPwa, setIsPwa] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // standalone PWA / iOS 全屏:fake-statusbar 才显示,避免双层状态栏
    const standalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      // @ts-ignore iOS Safari 私有属性
      window.navigator?.standalone === true;
    setIsPwa(Boolean(standalone));
    setNow(new Date());
    // 每分钟刷新一次,避免长时间停留静态态
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // SSR / 加载初期占位:显示静态 9:41(原型机默认)
  const timeLabel = now ? formatTime(now) : '9:41';

  return (
    <div className="phone-shell">
      <div className={`fake-statusbar ${isPwa ? 'is-pwa' : ''}`}>
        <span>{timeLabel}</span>
        <span className="flex items-center gap-1.5" aria-hidden="true">
          {/* 信号格 */}
          <span className="flex items-end gap-[1.5px]">
            <span className="w-[3px] h-[4px] bg-current rounded-[1px]" />
            <span className="w-[3px] h-[6px] bg-current rounded-[1px]" />
            <span className="w-[3px] h-[8px] bg-current rounded-[1px]" />
            <span className="w-[3px] h-[10px] bg-current rounded-[1px]" />
          </span>
          {/* WiFi 弧 */}
          <svg viewBox="0 0 16 12" width="14" height="10" fill="none" aria-hidden="true" focusable="false">
            <path d="M8 11.5l1.8-1.8a2.55 2.55 0 0 0-3.6 0L8 11.5z" fill="currentColor" />
            <path d="M3.6 7.1A6.2 6.2 0 0 1 12.4 7.1l1.3-1.3a7.8 7.8 0 0 0-10.8 0l1.1 1.3z" fill="currentColor" opacity="0.85" />
            <path d="M1 4.5a9.5 9.5 0 0 1 14 0l1.1-1.1a11 11 0 0 0-16.2 0L1 4.5z" fill="currentColor" opacity="0.65" />
          </svg>
          {/* 电池 */}
          <span className="ml-1 inline-flex items-center">
            <span className="w-[18px] h-[9px] border border-current rounded-[2px] relative flex items-center px-[1px]">
              <span className="block h-[5px] w-[80%] bg-current rounded-[1px]" />
            </span>
            <span className="w-[2px] h-[4px] bg-current ml-[1px] rounded-r" />
          </span>
        </span>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
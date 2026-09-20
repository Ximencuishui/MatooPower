'use client';
import { ReactNode } from 'react';

export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="phone-shell">
      <div className="fake-statusbar">
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
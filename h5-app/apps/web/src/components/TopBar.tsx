'use client';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';

export function TopBar({ title, right }: { title: string; right?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="topbar">
      <button aria-label="back" className="back-btn" onClick={() => router.back()}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <h1 className="text-[15px] font-semibold">{title}</h1>
      <div className="w-9 flex items-center justify-end">{right}</div>
    </header>
  );
}
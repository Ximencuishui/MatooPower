'use client';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TabBar } from '@/components/TabBar';
import { LangSwitch } from '@/components/LangSwitch';
import { useT } from '@/lib/i18n';
import { DEMO_DEVICES } from '@/data/mock';

export default function HomePage() {
  const { t } = useT();
  return (
    <PhoneShell>
      <header className="topbar">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-matoo flex items-center justify-center text-white font-bold text-sm">M</div>
          <span className="font-semibold text-[15px]">{t.app.name}</span>
        </div>
        <LangSwitch />
      </header>

      <main className="flex-1 overflow-auto p-4 space-y-4">
        {/* 欢迎卡 + 扫码 CTA */}
        <section className="card p-4 bg-gradient-to-br from-matoo-light to-white">
          <div className="text-[13px] text-matoo-dark font-medium">{t.app.tagline}</div>
          <h2 className="mt-1 text-lg font-bold">{t.home.welcome}</h2>
          <p className="text-sm text-slate-500 mt-1">{t.home.welcomeDesc}</p>
          <Link href="/scan/MATO-MAT12200-DEMO0001" className="btn-primary mt-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mr-2">
              <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {t.home.scanBtn}
          </Link>
        </section>

        {/* 我的设备（精简） */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">{t.home.myDevices}</h3>
            <Link href="/devices" className="text-xs text-matoo">{t.home.viewAll}</Link>
          </div>
          <div className="space-y-2">
            {DEMO_DEVICES.slice(0, 2).map((d) => (
              <Link key={d.id} href={`/device/${d.skuId}`} className="card p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-matoo-light flex items-center justify-center text-matoo font-bold">M</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{d.product.split(' ').slice(0, 3).join(' ')}…</div>
                  <div className="text-xs text-slate-500">{d.serial}</div>
                </div>
                <span className={`chip ${d.warrantyStatus === 'active' ? 'chip-green' : 'chip-orange'}`}>
                  {d.warrantyStatus === 'active' ? t.warranty.statusActive : t.warranty.statusPending}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* 常用服务九宫格 */}
        <section>
          <h3 className="font-semibold mb-2">{t.home.services}</h3>
          <div className="grid grid-cols-3 gap-3">
            <Link href="/scan/MATO-MAT12200-DEMO0001" className="card p-3 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-matoo-light text-matoo flex items-center justify-center">📘</div>
              <span className="text-xs mt-1">{t.home.sManual}</span>
            </Link>
            <Link href="/scan/MATO-MAT12200-DEMO0001" className="card p-3 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-matoo-light text-matoo flex items-center justify-center">🎬</div>
              <span className="text-xs mt-1">{t.home.sVideo}</span>
            </Link>
            <Link href="/activate/MATO-MAT12200-DEMO0001" className="card p-3 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-matoo-light text-matoo flex items-center justify-center">🛡</div>
              <span className="text-xs mt-1">{t.home.sWarranty}</span>
            </Link>
            <Link href="/scan/MATO-MAT12200-DEMO0001" className="card p-3 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-matoo-light text-matoo flex items-center justify-center">🔗</div>
              <span className="text-xs mt-1">{t.home.sBind}</span>
            </Link>
            <Link href="/shop" className="card p-3 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-matoo-light text-matoo flex items-center justify-center">🛒</div>
              <span className="text-xs mt-1">{t.home.sShop}</span>
            </Link>
            <Link href="/devices/compare" className="card p-3 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-matoo-light text-matoo flex items-center justify-center">📊</div>
              <span className="text-xs mt-1">{t.home.sCompare}</span>
            </Link>
          </div>
        </section>

        {/* 场景入口（演示用） */}
        <section className="card p-3 bg-amber-50/60 border border-amber-100 text-amber-900 text-xs space-y-1">
          <div className="font-semibold">{t.home.demoTitle}</div>
          <Link href="/dealer/batch" className="block underline">· {t.home.demoDealer}</Link>
          <Link href="/scan/FAKE-CODE-0000" className="block underline">· {t.home.demoFake}</Link>
          <Link href="/scan/REVOKED-CODE-0000" className="block underline">· {t.home.demoRevoked}</Link>
          <Link href="/scan/NETERR-CODE-0000" className="block underline">· {t.home.demoNetwork}</Link>
        </section>

        <p className="text-[11px] text-slate-400 text-center pt-4">
          {t.home.footer}
        </p>
      </main>

      <TabBar />
    </PhoneShell>
  );
}
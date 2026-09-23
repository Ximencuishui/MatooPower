'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { PhoneShell } from '@/components/PhoneShell';
import { TabBar } from '@/components/TabBar';
import { LangSwitch } from '@/components/LangSwitch';
import { PageLoading, SkeletonBlock } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { EmptyState } from '@/components/EmptyState';
import { Brand } from '@/components/Brand';
import { useT } from '@/lib/i18n';
import { listMyDevices, listMyTickets } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { getSession } from '@/lib/api/auth-store';
import { useAbortedFetch } from '@/hooks/useAbortedFetch';
import type { DeviceDto, TicketItem } from '@/lib/api/endpoints';

export default function HomePage() {
  const { t } = useT();
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [devices, setDevices] = useState<DeviceDto[] | null>(null);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [error, setError] = useState<unknown>(null);
  // P0 UX-10:onRetry 时递增 reloadKey 触发重新 fetch
  const [reloadKey, setReloadKey] = useState(0);
  const sessionRef = useRef<ReturnType<typeof getSession>>(null);

  function load() {
    setError(null);
    setReloadKey((k) => k + 1);
  }

  // 首次入场读取 session
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = getSession();
    sessionRef.current = s;
    setSession(s);
  }, []);

  // P0 UX-10:用 useAbortedFetch 取代裸 useEffect+load,组件卸载或 reload 时取消
  useAbortedFetch((signal) => {
    const s = sessionRef.current ?? session;
    if (!s?.token) { setDevices([]); return; }
    Promise.all([
      listMyDevices({ signal }).catch((e) => {
        if ((e as { name?: string })?.name === 'AbortError') throw e;
        setError(e);
        return { items: [] };
      }),
      listMyTickets(undefined, { signal }).catch(() => ({ items: [] })),
    ]).then(([d, k]) => {
      setDevices(d.items);
      setTickets(k.items);
    });
  }, [reloadKey]);

  return (
    <PhoneShell>
      <header className="topbar">
        <div className="flex items-center gap-2">
          {/* UX-22:六边形 + 蓝绿渐变 M logo,对齐 website/assets/logo.svg */}
          <Brand variant="icon" className="w-7 h-8" />
          <span className="font-semibold text-[15px]">{t.app.name}</span>
        </div>
        <LangSwitch />
      </header>

      <main className="flex-1 overflow-auto p-4 space-y-4">
        {/* 未登录引导登录 */}
        {!session?.token && (
          <Link href="/auth?next=/home" className="card p-4 bg-gradient-to-br from-matoo-light to-white flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-matoo text-white flex items-center justify-center text-lg">→</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{t.common.goLogin}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.common.loginRequiredHint}</div>
            </div>
            <span aria-hidden="true" className="text-matoo">›</span>
          </Link>
        )}

        <section className="card p-4 bg-gradient-to-br from-matoo-light to-white">
          <div className="text-[13px] text-matoo-dark font-medium">{t.app.tagline}</div>
          <h2 className="mt-1 text-lg font-bold">{t.home.welcome}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.home.welcomeDesc}</p>
          <Link href="/scan/MATO-MAT12200-DEMO0001" className="btn-primary mt-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mr-2">
              <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {t.home.scanBtn}
          </Link>
        </section>

        {/* 我的设备 */}
        {error != null && <ErrorBlock error={error} onRetry={load} showLoginLink={error instanceof ApiError && error.status === 401} loginNext="/home" />}
        {!error && devices === null && session?.token && (
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-1/3" />
            <SkeletonBlock className="h-16 w-full" />
            <SkeletonBlock className="h-16 w-full" />
          </div>
        )}

        {!error && devices !== null && devices.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{t.home.myDevices}</h3>
              <Link href="/devices" className="text-xs text-matoo">{t.home.viewAll}</Link>
            </div>
            <div className="space-y-2">
              {devices.slice(0, 2).map((d) => (
                <Link key={d.id} href={`/device/${d.id}`} className="card p-3 flex items-center gap-3">
                  {/* UX-22:六边形 + 渐变 M logo,与顶栏 logo 一致 */}
                  <div className="w-12 h-12 rounded-xl bg-matoo-light flex items-center justify-center" aria-hidden="true">
                    <Brand variant="icon" className="w-7 h-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" title={d.s_modelName ?? d.skuId}>{d.s_modelName ?? d.skuId}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{d.s_serial ?? d.skuId}</div>
                  </div>
                  <span className="chip chip-green">{t.devices.bound}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!error && devices !== null && devices.length === 0 && session?.token && (
          <EmptyState icon="📱" title={t.devices.empty} ctaLabel={t.home.scanBtn} ctaHref="/scan/MATO-MAT12200-DEMO0001" />
        )}

        {/* 工单小红点 */}
        {tickets.length > 0 && (
          <Link href="/messages" className="card p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center" aria-hidden="true">🎫</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{t.messages.title}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {tickets.filter((x) => x.status !== 'closed' && x.status !== 'resolved').length} 待处理 ·{' '}
                {tickets.filter((x) => x.severity === 'urgent' || x.severity === 'high').length > 0 && (
                  <span className="text-red-600">{tickets.filter((x) => x.severity === 'urgent' || x.severity === 'high').length} 紧急</span>
                )}
              </div>
            </div>
            <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">›</span>
          </Link>
        )}

        {/* 九宫格 */}
        <section>
          <h3 className="font-semibold mb-2">{t.home.services}</h3>
          <div className="grid grid-cols-3 gap-3">
            <Link href="/scan/MATO-MAT12200-DEMO0001" className="card p-3 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-matoo-light text-matoo flex items-center justify-center" aria-hidden="true">📘</div>
              <span className="text-xs mt-1">{t.home.sManual}</span>
            </Link>
            <Link href="/scan/MATO-MAT12200-DEMO0001" className="card p-3 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-matoo-light text-matoo flex items-center justify-center" aria-hidden="true">🎬</div>
              <span className="text-xs mt-1">{t.home.sVideo}</span>
            </Link>
            <Link href="/activate/MATO-MAT12200-DEMO0001" className="card p-3 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-matoo-light text-matoo flex items-center justify-center" aria-hidden="true">🛡</div>
              <span className="text-xs mt-1">{t.home.sWarranty}</span>
            </Link>
            <Link href="/scan/MATO-MAT12200-DEMO0001" className="card p-3 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-matoo-light text-matoo flex items-center justify-center" aria-hidden="true">🔗</div>
              <span className="text-xs mt-1">{t.home.sBind}</span>
            </Link>
            <Link href="/shop" className="card p-3 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-matoo-light text-matoo flex items-center justify-center" aria-hidden="true">🛒</div>
              <span className="text-xs mt-1">{t.home.sShop}</span>
            </Link>
            <Link href="/devices/compare" className="card p-3 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-matoo-light text-matoo flex items-center justify-center" aria-hidden="true">📊</div>
              <span className="text-xs mt-1">{t.home.sCompare}</span>
            </Link>
          </div>
        </section>

        {/* demo 入口 — 仅在 DEMO_MODE 或显式开启时可见(P2-1:生产期必须隐藏) */}
        <DemoSection role={session?.role} />

        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center pt-4">{t.home.footer}</p>
      </main>

      <TabBar />
    </PhoneShell>
  );
}

// demo 入口条件渲染:env 标记 / localStorage 显式开启 / dealer+admin 默认可见
function DemoSection({ role }: { role?: string }) {
  const { t } = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const env = (process.env.NEXT_PUBLIC_DEMO_MODE ?? '').toLowerCase();
    const override = window.localStorage.getItem('matoo.demo');
    const isDemo = env === '1' || env === 'true' || override === '1';
    const privileged = role === 'dealer' || role === 'admin';
    setVisible(isDemo || privileged);
  }, [role]);

  if (!visible) return null;

  return (
    <section
      data-testid="demo-section"
      className="card p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 text-amber-900 dark:text-amber-300 text-xs space-y-1"
    >
      <div className="font-semibold flex items-center justify-between">
        <span>{t.home.demoTitle}</span>
        <span className="chip chip-orange text-[9px]">DEMO</span>
      </div>
      <Link href="/dealer/batch" className="block underline">· {t.home.demoDealer}</Link>
      <Link href="/scan/FAKE-CODE-0000" className="block underline">· {t.home.demoFake}</Link>
      <Link href="/scan/REVOKED-CODE-0000" className="block underline">· {t.home.demoRevoked}</Link>
      <Link href="/scan/NETERR-CODE-0000" className="block underline">· {t.home.demoNetwork}</Link>
    </section>
  );
}

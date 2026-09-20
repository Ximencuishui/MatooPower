'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/PhoneShell';
import { TabBar } from '@/components/TabBar';
import { LangSwitch } from '@/components/LangSwitch';
import { Confirm } from '@/components/Confirm';
import { useT } from '@/lib/i18n';
import { getSession, clearSession } from '@/lib/api/auth-store';
import { toast } from '@/components/Toast';

export default function ProfilePage() {
  const { t } = useT();
  const router = useRouter();
  const session = typeof window !== 'undefined' ? getSession() : null;
  const role = session?.role ?? 'guest';
  const isLoggedIn = !!session?.token;

  // 真实登录显示用户信息,未登录显示占位 + 登录 CTA
  const displayName = session?.displayName ?? (isLoggedIn ? 'Demo User' : t.common.loginRequired);
  const phone = session?.phone ?? t.profile.phone;

  // P0-7:7 个菜单 — 已实现的 <Link>,未实现的 <button disabled> + tooltip
  const menuItems = [
    { ico: '🧾', key: 'orders' as const, href: '/legal/privacy', label: t.profile.orders, soon: true },
    { ico: '🛡', key: 'warrantyRecords' as const, href: '/devices', label: t.profile.warrantyRecords },
    { ico: '🎫', key: 'tickets' as const, href: '/tickets', label: t.profile.tickets },
    { ico: '🏠', key: 'address' as const, href: undefined, label: t.profile.address, soon: true },
    { ico: '🌐', key: 'lang' as const, href: undefined, label: t.common.lang, soon: false, isLang: true },
    { ico: '💬', key: 'support' as const, href: 'https://wa.me/WHATSAPP_PLACEHOLDER', external: true, label: t.profile.support },
    { ico: '⚙', key: 'settings' as const, href: undefined, label: t.profile.settings, soon: true },
  ];

  function doLogout() {
    clearSession();
    toast(t.common.logout + ' ✓', 'success');
    router.push('/home');
  }

  return (
    <PhoneShell>
      <header className="topbar">
        <h1 className="text-[15px] font-semibold">{t.tabs.profile}</h1>
        <LangSwitch />
      </header>
      <main className="flex-1 overflow-auto p-4 space-y-3">
        {/* 用户卡 — 未登录显示 CTA */}
        {isLoggedIn ? (
          <div className="card p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-matoo-light text-matoo flex items-center justify-center font-bold">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="font-semibold">{displayName}</div>
              <div className="text-xs text-slate-500">{phone} · {t.profile.role} · {role}</div>
            </div>
            <span className="chip chip-green" role="status">{t.profile.loggedIn}</span>
          </div>
        ) : (
          <Link href="/auth?next=/profile" className="card p-4 flex items-center gap-3 bg-gradient-to-br from-matoo-light to-white">
            <div className="w-12 h-12 rounded-full bg-matoo text-white flex items-center justify-center font-bold">→</div>
            <div className="flex-1">
              <div className="font-semibold">{t.common.goLogin}</div>
              <div className="text-xs text-slate-500">{t.common.loginRequiredHint}</div>
            </div>
            <span aria-hidden="true" className="text-matoo">›</span>
          </Link>
        )}

        {/* 经销商工作台入口 */}
        {(role === 'dealer' || role === 'admin') && (
          <Link href="/dealer/dashboard" className="card p-4 flex items-center gap-3 bg-gradient-to-br from-matoo-light to-white">
            <div className="w-12 h-12 rounded-xl bg-matoo text-white flex items-center justify-center text-lg">🛒</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{t.dealer.title}</div>
              <div className="text-[11px] text-slate-500">{t.dealer.overview} · {t.dealer.bulkSubmitLabel}</div>
            </div>
            <span className="text-matoo" aria-hidden="true">›</span>
          </Link>
        )}

        {/* admin 三个工作台 */}
        {role === 'admin' && (
          <>
            <Link href="/admin/overview" className="card p-4 flex items-center gap-3 bg-gradient-to-br from-amber-50 to-white border border-amber-100 dark:border-amber-900">
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg">📊</div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{t.adminOverview.title}</div>
                <div className="text-[11px] text-slate-500">{t.adminOverview.skuTotal} · {t.adminOverview.ticketsTitle}</div>
              </div>
              <span className="text-amber-600" aria-hidden="true">›</span>
            </Link>
            <Link href="/admin/analytics" className="card p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-lg">📈</div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{t.adminAnalytics.title}</div>
                <div className="text-[11px] text-slate-500">{t.adminAnalytics.warrantyTrend} · {t.adminAnalytics.ticketTrend}</div>
              </div>
              <span className="text-slate-400" aria-hidden="true">›</span>
            </Link>
            <Link href="/admin/tickets" className="card p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg">🎫</div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{t.ticket.adminTitle}</div>
                <div className="text-[11px] text-slate-500">{t.ticket.kpiOpen} · {t.ticket.kpiUrgent}</div>
              </div>
              <span className="text-slate-400" aria-hidden="true">›</span>
            </Link>
          </>
        )}

        {/* 我的工单 */}
        <Link href="/tickets" className="card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center text-lg">🎫</div>
          <div className="flex-1">
            <div className="text-sm font-semibold">{t.ticket.mineTitle}</div>
            <div className="text-[11px] text-slate-500">{t.ticket.newTitle} · {t.ticket.conversation}</div>
          </div>
          <span className="text-slate-400" aria-hidden="true">›</span>
        </Link>

        {/* 菜单列表 — P0-7 全部 Link 化 / disabled */}
        <div className="card divide-y dark:divide-slate-700">
          {menuItems.map((m, i) => {
            const content = (
              <span className="flex items-center gap-3 text-sm">
                <span aria-hidden="true" className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center">{m.ico}</span>
                <span className={m.soon ? 'opacity-50' : ''}>{m.label}</span>
                {m.soon && <span className="chip chip-gray text-[9px] ml-1">{t.common.comingSoon}</span>}
              </span>
            );
            const right = <span className="text-slate-400" aria-hidden="true">›</span>;

            if (m.isLang) {
              return (
                <div key={i} className="w-full flex items-center justify-between p-3 text-left">
                  {content}
                  <LangSwitch />
                </div>
              );
            }
            if (m.external) {
              return (
                <a key={i} href={m.href} target="_blank" rel="noopener" className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
                  {content}
                  {right}
                </a>
              );
            }
            if (m.href && !m.soon) {
              return (
                <Link key={i} href={m.href} className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
                  {content}
                  {right}
                </Link>
              );
            }
            return (
              <button key={i} disabled className="w-full flex items-center justify-between p-3 text-left opacity-60 cursor-not-allowed">
                {content}
                {right}
              </button>
            );
          })}
        </div>

        {/* 退出登录 */}
        {isLoggedIn && (
          <Confirm
            trigger={(open) => (
              <button onClick={open} className="card p-3 w-full text-center text-red-600 dark:text-red-300 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30">
                {t.common.logout}
              </button>
            )}
            title={t.common.logout}
            description={t.common.logoutConfirm}
            confirmLabel={t.common.logout}
            cancelLabel={t.common.cancel}
            destructive
            onConfirm={doLogout}
          />
        )}

        <div className="card p-3 text-xs text-slate-500 leading-relaxed">
          <div className="font-semibold mb-1">{t.profile.aboutTitle}</div>
          {t.profile.aboutLine1}<br/>
          {t.profile.aboutLine2}
        </div>
      </main>
      <TabBar />
    </PhoneShell>
  );
}

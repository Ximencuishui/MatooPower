'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/PhoneShell';
import { TabBar } from '@/components/TabBar';
import { LangSwitch } from '@/components/LangSwitch';
import { Confirm } from '@/components/Confirm';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AppearanceCard } from '@/components/AppearanceCard';
import { restartOnboarding } from '@/components/Onboarding';
import { Brand } from '@/components/Brand';
import { SocialRow, type SocialPlatform } from '@/components/SocialIcons';
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

  // P2-3:在线客服链接用 env 可配置;演示期提供 fallback 弹窗提示
  const WHATSAPP_NUMBER =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_WA_NUMBER || '';

  // 关注矩阵 — 与 website 同源(env 可覆盖,默认值对齐 matoopower.com 主页)
  const SOCIAL_LINKS: Partial<Record<SocialPlatform, string>> = {
    facebook:  process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK  || 'https://www.facebook.com/MatooPower',
    wechat:    process.env.NEXT_PUBLIC_SOCIAL_WECHAT    || undefined, // 微信仅扫码,见下面 wechatId
    linkedin:  process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN  || 'https://www.linkedin.com/company/matoopower',
    twitter:   process.env.NEXT_PUBLIC_SOCIAL_TWITTER   || 'https://x.com/MatooPower',
    youtube:   process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE   || 'https://www.youtube.com/@MatooPower',
    instagram: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || 'https://www.instagram.com/matoopower',
    whatsapp:  WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER.replace(/[^\d]/g, '')}` : undefined,
  };
  const WECHAT_ID = process.env.NEXT_PUBLIC_WECHAT_ID || 'MatooPower';
  const menuItems = [
    { ico: '🧾', key: 'orders' as const, href: '/legal/privacy', label: t.profile.orders, soon: true },
    { ico: '🛡', key: 'warrantyRecords' as const, href: '/devices', label: t.profile.warrantyRecords },
    { ico: '🎫', key: 'tickets' as const, href: '/tickets', label: t.profile.tickets },
    { ico: '🏠', key: 'address' as const, href: undefined, label: t.profile.address, soon: true },
    { ico: '🌐', key: 'lang' as const, href: undefined, label: t.common.lang, soon: false, isLang: true },
    { ico: '💬', key: 'support' as const, href: WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER.replace(/[^\d]/g, '')}` : '', external: !!WHATSAPP_NUMBER, label: t.profile.support, isSupport: true },
    { ico: '⚙', key: 'settings' as const, href: undefined, label: t.profile.settings, soon: true },
  ];

  function doLogout() {
    void clearSession();
    toast(t.common.logout + ' ✓', 'success');
    router.push('/home');
  }

  return (
    <PhoneShell>
      <header className="topbar">
        <h1 className="text-[15px] font-semibold">{t.tabs.profile}</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LangSwitch />
        </div>
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
              <div className="text-xs text-slate-500 dark:text-slate-400">{phone} · {t.profile.role} · {role}</div>
            </div>
            <span className="chip chip-green" role="status">{t.profile.loggedIn}</span>
          </div>
        ) : (
          <Link href="/auth?next=/profile" className="card p-4 flex items-center gap-3 bg-gradient-to-br from-matoo-light to-white">
            <div className="w-12 h-12 rounded-full bg-matoo text-white flex items-center justify-center font-bold">→</div>
            <div className="flex-1">
              <div className="font-semibold">{t.common.goLogin}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t.common.loginRequiredHint}</div>
            </div>
            <span aria-hidden="true" className="text-matoo">›</span>
          </Link>
        )}

        {/* P1 外观主题切换面板(亮 / 跟随系统 / 暗) — 与头部 ThemeToggle 共享 useThemeMode */}
        <AppearanceCard />

        {/* 经销商工作台入口 */}
        {(role === 'dealer' || role === 'admin') && (
          <Link href="/dealer/dashboard" className="card p-4 flex items-center gap-3 bg-gradient-to-br from-matoo-light to-white">
            <div className="w-12 h-12 rounded-xl bg-matoo text-white flex items-center justify-center text-lg">🛒</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{t.dealer.title}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.dealer.overview} · {t.dealer.bulkSubmitLabel}</div>
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
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.adminOverview.skuTotal} · {t.adminOverview.ticketsTitle}</div>
              </div>
              <span className="text-amber-600" aria-hidden="true">›</span>
            </Link>
            <Link href="/admin/analytics" className="card p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-lg">📈</div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{t.adminAnalytics.title}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.adminAnalytics.warrantyTrend} · {t.adminAnalytics.ticketTrend}</div>
              </div>
              <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">›</span>
            </Link>
            <Link href="/admin/tickets" className="card p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg">🎫</div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{t.ticket.adminTitle}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.ticket.kpiOpen} · {t.ticket.kpiUrgent}</div>
              </div>
              <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">›</span>
            </Link>
          </>
        )}

        {/* 我的工单 */}
        <Link href="/tickets" className="card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-lg">🎫</div>
          <div className="flex-1">
            <div className="text-sm font-semibold">{t.ticket.mineTitle}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.ticket.newTitle} · {t.ticket.conversation}</div>
          </div>
          <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">›</span>
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
            const right = <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">›</span>;

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
            if (m.isSupport && !m.external) {
              // P2-3:未配置客服号码时,提示用 in-app 工单替代
              return (
                <button
                  key={i}
                  onClick={() => toast('客服 WhatsApp 暂未配置，请使用工单联系', 'info')}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {content}
                  {right}
                </button>
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

        <div className="card p-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          <div className="font-semibold mb-1">{t.profile.aboutTitle}</div>
          {t.profile.aboutLine1}<br/>
          {t.profile.aboutLine2}
        </div>

        {/* Follow Us — 对齐 website footer .footer-social-row 的 7 平台矩阵 */}
        <section className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{t.profile.followUs}</h4>
            <Brand variant="icon" className="w-5 h-6" aria-label="Matoo Power" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.profile.followHint}</p>
          <SocialRow
            links={SOCIAL_LINKS}
            tone="light"
            size={36}
            gap="gap-2"
          />
          {/* WeChat 仅展示微信号(扫码场景,点击复制) */}
          {!SOCIAL_LINKS.wechat && (
            <div className="flex items-center gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
              <span aria-hidden="true">💬</span>
              <span>WeChat:</span>
              <button
                type="button"
                className="font-mono underline decoration-dotted hover:text-matoo"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(WECHAT_ID).then(
                      () => toast(t.common.save + ' ✓', 'success'),
                      () => toast(WECHAT_ID, 'info'),
                    );
                  } else {
                    toast(WECHAT_ID, 'info');
                  }
                }}
                aria-label={`Copy WeChat ID ${WECHAT_ID}`}
              >
                {WECHAT_ID}
              </button>
            </div>
          )}
        </section>

        <button
          onClick={() => { restartOnboarding(); if (typeof window !== 'undefined') window.location.reload(); }}
          className="card p-3 w-full text-center text-sm text-matoo dark:text-matoo-light hover:bg-matoo-light/30 dark:hover:bg-matoo/10"
        >
          🎬 重新查看引导
        </button>
      </main>
      <TabBar />
    </PhoneShell>
  );
}

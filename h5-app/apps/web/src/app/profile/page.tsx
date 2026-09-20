'use client';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TabBar } from '@/components/TabBar';
import { LangSwitch } from '@/components/LangSwitch';
import { useT } from '@/lib/i18n';
import { getSession } from '@/lib/api/auth-store';

export default function ProfilePage() {
  const { t } = useT();
  // 仅 client 端读取；SSR 阶段 getSession 返回 null → 不显示 dashboard 入口
  const session = typeof window !== 'undefined' ? getSession() : null;
  const role = session?.role ?? 'customer';

  const menuItems = [
    { ico: '🧾', key: 'orders' as const },
    { ico: '🛡', key: 'warrantyRecords' as const },
    { ico: '🎫', key: 'tickets' as const },
    { ico: '🏠', key: 'address' as const },
    { ico: '🌐', key: 'lang' as const, labelOverride: t.common.lang },
    { ico: '💬', key: 'support' as const },
    { ico: '⚙', key: 'settings' as const },
  ];

  return (
    <PhoneShell>
      <header className="topbar">
        <h1 className="text-[15px] font-semibold">{t.tabs.profile}</h1>
        <LangSwitch />
      </header>
      <main className="flex-1 overflow-auto p-4 space-y-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-matoo-light text-matoo flex items-center justify-center font-bold">S</div>
          <div className="flex-1">
            <div className="font-semibold">Demo User</div>
            <div className="text-xs text-slate-500">{t.profile.phone} · {t.profile.role} · {role}</div>
          </div>
          <span className="chip chip-green" role="status">{t.profile.loggedIn}</span>
        </div>

        {/* 经销商工作台入口（dealer + admin 才显示） */}
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

        {/* 客服工作台（仅 admin） */}
        {role === 'admin' && (
          <>
            <Link href="/admin/overview" className="card p-4 flex items-center gap-3 bg-gradient-to-br from-amber-50 to-white border border-amber-100">
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg">📊</div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{t.adminOverview.title}</div>
                <div className="text-[11px] text-slate-500">{t.adminOverview.skuTotal} · {t.adminOverview.ticketsTitle}</div>
              </div>
              <span className="text-amber-600" aria-hidden="true">›</span>
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

        <div className="card divide-y">
          {menuItems.map((m, i) => (
            <button key={i} className="w-full flex items-center justify-between p-3 text-left">
              <span className="flex items-center gap-3 text-sm">
                <span aria-hidden="true" className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center">{m.ico}</span>
                {m.labelOverride ?? t.profile[m.key]}
              </span>
              <span className="text-slate-400" aria-hidden="true">›</span>
            </button>
          ))}
        </div>

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
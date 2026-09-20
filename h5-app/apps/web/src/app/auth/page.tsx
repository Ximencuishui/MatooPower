'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { Spinner } from '@/components/Spinner';
import { useT } from '@/lib/i18n';
import { requestOtp, verifyOtp } from '@/lib/api/operations';
import type { OtpVerifyBody } from '@/lib/api/endpoints';
import { setSession } from '@/lib/api/auth-store';
import { ApiError } from '@/lib/api/client';
import { toast } from '@/components/Toast';

type Tab = 'phone' | 'email' | 'wa';

function AuthInner() {
  const { t } = useT();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/home';

  const [tab, setTab] = useState<Tab>('phone');
  const [phone, setPhone] = useState('+880');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [agree, setAgree] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function sendCode() {
    if (countdown > 0 || submitting) return;
    setError(null); setInfo(null);
    setSubmitting(true);
    try {
      await requestOtp({ phone });
      setInfo(t.auth.codeSentHint);
      toast(t.auth.codeSentHint, 'info');
      setCountdown(60);
      const i = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(i); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.auth.sendFailed;
      setError(msg);
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    if (submitting) return;
    setError(null); setInfo(null);

    if (tab === 'phone' || tab === 'wa') {
      if (!phone || !code) {
        setError(t.auth.fillAll);
        return;
      }
      setSubmitting(true);
      try {
        const body: OtpVerifyBody = { phone, code };
        const r = await verifyOtp(body);
        setSession({
          token: r.token,
          userId: r.user.id,
          role: r.user.role,
          displayName: r.user.displayName,
          phone: r.user.phone,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        toast(t.auth.login + ' ✓', 'success');
        router.push(next);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.auth.loginFailed);
        setError(msg);
        toast(msg, 'error');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (tab === 'email') {
      setError(t.auth.emailLoginNotImplemented);
      return;
    }
  }

  return (
    <PhoneShell>
      <TopBar title={t.auth.login} />
      <main className="flex-1 overflow-auto p-4 space-y-4">
        <h2 className="text-xl font-bold">{t.auth.welcomeBack}</h2>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-sm" role="tablist">
          {[
            { k: 'phone' as Tab, l: t.auth.phoneOtp },
            { k: 'email' as Tab, l: t.auth.emailPwd },
            { k: 'wa' as Tab, l: t.auth.whatsapp },
          ].map((tt) => (
            <button
              key={tt.k}
              role="tab"
              aria-selected={tab === tt.k}
              onClick={() => setTab(tt.k)}
              className={`flex-1 py-2 rounded-lg transition ${tab === tt.k ? 'bg-white dark:bg-slate-700 shadow-sm font-semibold' : 'text-slate-500'}`}
            >
              {tt.l}
            </button>
          ))}
        </div>

        {tab === 'phone' && (
          <div className="space-y-3">
            <div>
              <label htmlFor="auth-phone" className="label">{t.auth.phone}</label>
              <input id="auth-phone" type="tel" inputMode="tel" pattern="^\+[0-9]{6,15}$" autoComplete="tel"
                className="input" placeholder={t.auth.phonePh} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label htmlFor="auth-code" className="label">{t.auth.code}</label>
              <div className="flex gap-2">
                <input id="auth-code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                  autoComplete="one-time-code" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                  className="input flex-1" placeholder={t.auth.codePh} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                <button
                  onClick={sendCode}
                  className="px-3 rounded-xl border border-matoo text-matoo font-medium text-sm disabled:border-slate-200 disabled:text-slate-400 inline-flex items-center gap-1"
                  disabled={countdown > 0 || submitting || !phone}
                >
                  {submitting ? <Spinner size="sm" /> : null}
                  {countdown > 0 ? t.auth.resendIn.replace('{s}', String(countdown)) : t.auth.sendCode}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'email' && (
          <div className="space-y-3">
            <div>
              <label htmlFor="auth-email" className="label">{t.auth.email}</label>
              <input id="auth-email" type="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                className="input" placeholder={t.auth.emailPh} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <label htmlFor="auth-password" className="label">{t.auth.password}</label>
              <input id="auth-password" type="password" autoComplete="current-password"
                className="input" placeholder={t.auth.passwordPh} value={pwd} onChange={(e) => setPwd(e.target.value)} minLength={8} />
            </div>
          </div>
        )}

        {tab === 'wa' && (
          <div className="space-y-3">
            <div>
              <label htmlFor="auth-whatsapp" className="label">WhatsApp</label>
              <input id="auth-whatsapp" type="tel" inputMode="tel" autoComplete="tel"
                className="input" placeholder="+880 1xxx xxx xxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <p className="text-xs text-slate-500">{t.common.comingSoonHint}</p>
          </div>
        )}

        <label className="flex items-start gap-2 text-xs text-slate-500 mt-2">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
          <span>
            {t.auth.agree}
            <Link href="/legal/terms" target="_blank" rel="noopener" className="text-matoo mx-1 underline">{t.auth.terms}</Link>
            {t.auth.and}
            <Link href="/legal/privacy" target="_blank" rel="noopener" className="text-matoo mx-1 underline">{t.auth.privacy}</Link>
          </span>
        </label>

        {error && <div role="alert" className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300 p-3 rounded-xl">{error}</div>}
        {info && !error && <div role="status" className="text-xs text-matoo-dark bg-matoo-light dark:bg-matoo-light p-3 rounded-xl">{info}</div>}

        <button onClick={submit} disabled={!agree || submitting} className="btn-primary mt-4 inline-flex items-center justify-center gap-2">
          {submitting ? <Spinner size="sm" /> : null}
          {submitting ? t.common.loading : tab === 'email' ? t.auth.loginBtn : t.auth.registerBtn}
        </button>

        <p className="text-[11px] text-center text-slate-400 mt-2">
          {t.auth.demoNote}
        </p>
      </main>
    </PhoneShell>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<PhoneShell><main className="p-5 text-slate-400">Loading…</main></PhoneShell>}>
      <AuthInner />
    </Suspense>
  );
}

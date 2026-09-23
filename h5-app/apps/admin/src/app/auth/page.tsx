// Admin 桌面端登录页（OTP 流程）
// - 极简布局（居中卡片，全宽背景）
// - 完全独立于 web 的 lib/auth-store
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { requestOtp, verifyOtp } from '@/lib/api/operations';
import { setSession } from '@/lib/auth-store';
import { ApiError } from '@/lib/api/client';

const PHONE_RE = /^\+[0-9]{6,15}$/;

function AuthInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/admin/overview';

  const [phone, setPhone] = useState('+8801000000001');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSend() {
    setError(null);
    setInfo(null);
    if (!PHONE_RE.test(phone)) {
      setError('手机号格式：+ 国际区号 + 6-15 位数字');
      return;
    }
    setSending(true);
    try {
      const r = await requestOtp(phone);
      setInfo(`验证码已发送（TTL ${r.ttl}s）。请到 API 终端日志或运行 node scripts/get-otp.js ${phone} 获取 6 位数字。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setSending(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!PHONE_RE.test(phone)) {
      setError('手机号格式错误');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError('验证码必须是 6 位数字');
      return;
    }
    setSubmitting(true);
    try {
      const r = await verifyOtp(phone, code);
      setSession({ token: r.token, user: r.user });
      router.push(next);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('验证码错误或已过期');
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('登录失败');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-matoo-light/40 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="relative">
            <img
              src="/logo.svg"
              alt="Matoo Power"
              width={160}
              height={36}
              className="block dark:hidden h-9 w-auto"
            />
            <img
              src="/logo-white.svg"
              alt="Matoo Power"
              width={160}
              height={36}
              className="hidden dark:block h-9 w-auto"
            />
          </div>
          <div className="text-[11px] uppercase tracking-wider text-matoo font-medium">
            Admin Console
          </div>
        </div>

        <div className="card p-7 shadow-elevated">
          <h1 className="text-xl font-bold mb-1">Admin 登录</h1>
          <p className="text-sm text-slate-500 mb-6">
            用 admin 账号获取 6 位 OTP（演示期）
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                手机号
              </label>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="username"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+8801000000001"
                className="input"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onSend}
                disabled={sending}
                className="btn-secondary flex-1"
              >
                {sending ? '发送中…' : '获取验证码'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                6 位验证码
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="从后端终端日志读取"
                className="input font-mono tracking-widest text-center text-lg"
              />
            </div>

            {info && (
              <div className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg p-3">
                {info}
              </div>
            )}
            {error && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !code}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '登录中…' : '登录'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="text-[11px] text-slate-500 leading-relaxed">
              <strong>演示账号</strong>
              <div className="mt-1.5 font-mono text-[11px] space-y-0.5">
                <div>admin · <span className="text-matoo-dark">+8801000000001</span></div>
                <div>dealer · +8801000000003</div>
                <div>customer · +8801000000002</div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 text-center mt-4">
          © Matoo Power · 桌面端 Admin
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">加载中…</div>}>
      <AuthInner />
    </Suspense>
  );
}
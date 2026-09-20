'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { useT } from '@/lib/i18n';

type Kind = 'fake' | 'revoked' | 'network';

// 严格白名单：仅接受这三个值，其余一律当作 'fake'。防止恶意 URL 注入到客服收到的错误码。
const ALLOWED_KINDS = new Set<Kind>(['fake', 'revoked', 'network']);
const DEFAULT_KIND: Kind = 'fake';

// 错误码白名单：仅这几个固定值通过；其余显示 ERR_QR_UNKNOWN。
const ALLOWED_CODES = new Set<string>([
  'ERR_QR_SIGNATURE_INVALID',
  'ERR_BATCH_REVOKED',
  'ERR_NETWORK_TIMEOUT',
  'ERR_QR_UNKNOWN',
]);

function sanitizeKind(raw: string | null): Kind {
  if (raw && ALLOWED_KINDS.has(raw as Kind)) return raw as Kind;
  return DEFAULT_KIND;
}

function sanitizeCode(raw: string | null): string {
  if (raw && ALLOWED_CODES.has(raw)) return raw;
  return 'ERR_QR_UNKNOWN';
}

function FailInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { t } = useT();
  const kind = sanitizeKind(sp.get('kind'));
  const code = sanitizeCode(sp.get('code'));

  const [copied, setCopied] = useState(false);

  const meta = {
    fake: {
      title: t.fail.fake,
      desc: t.fail.fakeDesc,
      color: 'text-red-600',
      bg: 'bg-red-100',
      icon: '⚠️',
    },
    revoked: {
      title: t.fail.revoked,
      desc: t.fail.revokedDesc,
      color: 'text-amber-700',
      bg: 'bg-amber-100',
      icon: '🚫',
    },
    network: {
      title: t.fail.network,
      desc: t.fail.networkDesc,
      color: 'text-slate-700',
      bg: 'bg-slate-100',
      icon: '📡',
    },
  }[kind];

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <PhoneShell>
      <TopBar title={t.fail.title} />
      <main className="flex-1 overflow-auto p-5 flex flex-col items-center text-center">
        <div className={`w-20 h-20 mt-6 rounded-full ${meta.bg} flex items-center justify-center text-3xl`}>{meta.icon}</div>
        <h2 className={`text-lg font-bold mt-4 ${meta.color}`}>{meta.title}</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-xs">{meta.desc}</p>

        <div className="card p-3 mt-6 w-full flex items-center justify-between text-left">
          <div className="text-xs">
            <div className="text-slate-500">ERROR CODE</div>
            <div className="font-mono text-slate-800">{code}</div>
          </div>
          <button onClick={copy} className="text-xs px-3 py-1 rounded-md border border-matoo text-matoo">
            {copied ? t.fail.copied : t.fail.copy}
          </button>
        </div>

        <div className="w-full space-y-3 mt-6">
          <button onClick={() => router.push('/scan')} className="btn-primary">{t.fail.retry}</button>
          <Link href="/profile" className="btn-secondary">{t.fail.contact}</Link>
          <Link href="/home" className="btn-ghost text-slate-500">{t.fail.backHome}</Link>
        </div>
      </main>
    </PhoneShell>
  );
}

export default function FailPage() {
  return (
    <Suspense fallback={<PhoneShell><main className="p-5 text-slate-400">Loading…</main></PhoneShell>}>
      <FailInner />
    </Suspense>
  );
}
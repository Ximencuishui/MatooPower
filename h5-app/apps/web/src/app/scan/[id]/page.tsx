'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { ProductArt } from '@/components/ProductArt';
import { useT } from '@/lib/i18n';
import { getSku } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import type { SkuDto } from '@/lib/api/endpoints';

// 演示用失败 ID（生产期由后端真正返回 4xx 替代）
const DEMO_FAIL_MAP: Record<string, { kind: 'fake' | 'revoked' | 'network'; code: string }> = {
  'FAKE-CODE-0000': { kind: 'fake', code: 'ERR_QR_SIGNATURE_INVALID' },
  'REVOKED-CODE-0000': { kind: 'revoked', code: 'ERR_BATCH_REVOKED' },
  'NETERR-CODE-0000': { kind: 'network', code: 'ERR_NETWORK_TIMEOUT' },
};

function isDemoFail(id: string) {
  return id in DEMO_FAIL_MAP;
}

type LoadingState = 'loading' | 'demo-fail' | 'api-fail' | 'ok';

export default function ScanPage() {
  const params = useParams<{ id: string }>();
  const { t } = useT();
  const id = decodeURIComponent(params.id);

  const [state, setState] = useState<LoadingState>('loading');
  const [sku, setSku] = useState<SkuDto | null>(null);
  const [failKind, setFailKind] = useState<'fake' | 'revoked' | 'network' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // 1. 演示期 demo 失败码直接跳
    if (isDemoFail(id)) {
      const f = DEMO_FAIL_MAP[id]!;
      const qs = new URLSearchParams({ kind: f.kind, code: f.code }).toString();
      window.location.replace(`/scan/failed?${qs}`);
      setState('demo-fail');
      return;
    }

    // 2. 正常路径：调后端
    setState('loading');
    getSku(id)
      .then((s) => { setSku(s); setState('ok'); })
      .catch((err: unknown) => {
        // API 错误 → 跳统一失败页
        let kind: 'fake' | 'revoked' | 'network' = 'fake';
        let code = 'ERR_QR_UNKNOWN';
        if (err instanceof ApiError) {
          if (err.status === 404) { kind = 'fake'; code = 'ERR_QR_SIGNATURE_INVALID'; }
          else if (err.status === 410 || err.status === 409) { kind = 'revoked'; code = 'ERR_BATCH_REVOKED'; }
          else { kind = 'network'; code = 'ERR_NETWORK_TIMEOUT'; }
          setErrorMsg(err.message);
        } else {
          kind = 'network';
          setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
        }
        setFailKind(kind);
        const qs = new URLSearchParams({ kind, code }).toString();
        window.location.replace(`/scan/failed?${qs}`);
        setState('api-fail');
      });
  }, [id]);

  // 失败态:渲染轻量占位（hydrate 后已跳走）
  if (state === 'demo-fail' || state === 'api-fail' || (state === 'loading' && isDemoFail(id))) {
    return (
      <PhoneShell>
        <TopBar title={t.scan.redirecting} />
        <main className="p-5 text-slate-400 text-sm">
          {t.scan.redirectingHint}
          {errorMsg && <div className="mt-2 text-red-500 text-xs">{errorMsg}</div>}
        </main>
      </PhoneShell>
    );
  }

  // loading 占位
  if (state === 'loading') {
    return (
      <PhoneShell>
        <TopBar title={t.scan.productTitle} />
        <main className="p-5 flex items-center justify-center gap-2 text-slate-400 text-sm">
          <span className="animate-spin inline-block w-4 h-4 border-2 border-slate-300 border-t-matoo rounded-full" aria-hidden="true" />
          {t.scan.loadingHint}
        </main>
      </PhoneShell>
    );
  }

  // 正常 SKU
  if (!sku) return null;
  const isRepeated = sku.activated;
  const repeatedTime = sku.activatedAt ? new Date(sku.activatedAt).toLocaleString() : '—';

  return (
    <PhoneShell>
      <TopBar title={t.scan.productTitle} />
      <main className="flex-1 overflow-auto pb-6">
        <section className={`p-4 ${isRepeated ? 'bg-amber-50' : 'bg-matoo-light'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isRepeated ? 'bg-amber-100 text-amber-700' : 'bg-white text-matoo'}`}>
              ✓
            </div>
            <div>
              <div className={`text-sm font-semibold ${isRepeated ? 'text-amber-700' : 'text-matoo-dark'}`}>
                {isRepeated ? t.scan.repeated : t.scan.genuine}
              </div>
              <div className={`text-xs ${isRepeated ? 'text-amber-600' : 'text-matoo-dark/70'}`}>
                {isRepeated
                  ? t.scan.repeatedSub.replace('{time}', repeatedTime)
                  : t.scan.genuineSub}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 -mt-2">
          <div className="card p-4">
            <ProductArt variant="battery" />
            <div className="mt-3">
              <div className="text-xs text-matoo-dark font-medium">{t.scan.model}</div>
              <div className="text-[15px] font-bold">{sku.modelName}</div>
            </div>
          </div>
        </section>

        <section className="px-4 mt-3">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">{t.scan.productTitle}</h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">{t.scan.model}</div>
                <div className="font-medium">{sku.sku}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{t.scan.serial}</div>
                <div className="font-mono font-medium">{sku.serial}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{t.scan.capacity}</div>
                <div className="font-medium">{sku.capacity}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{t.scan.voltage}</div>
                <div className="font-medium">{sku.voltage}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{t.scan.chemistry}</div>
                <div className="font-medium">{sku.chemistry}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{t.scan.cycles}</div>
                <div className="font-medium">{sku.cycles}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{t.scan.batch}</div>
                <div className="font-medium">{sku.batch}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">MFG</div>
                <div className="font-medium">{sku.mfgDate.slice(0, 10)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 mt-3">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">{t.scan.docs}</h3>
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <button key={i} className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-matoo-light text-matoo flex items-center justify-center text-sm">📕</div>
                    <div className="text-left">
                      <div className="text-sm font-medium">{t.scan.manual}</div>
                      <div className="text-xs text-slate-500">PDF · {(3.0 + i * 0.1).toFixed(1)} MB</div>
                    </div>
                  </div>
                  <span aria-hidden="true" className="text-matoo text-sm">↓</span>
                </button>
              ))}
              <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div aria-hidden="true" className="w-8 h-8 rounded bg-matoo-light text-matoo flex items-center justify-center text-sm">▶</div>
                  <div className="text-left">
                    <div className="text-sm font-medium">{t.scan.video}</div>
                    <div className="text-xs text-slate-500">04:18</div>
                  </div>
                </div>
                <span aria-hidden="true" className="text-matoo text-sm">▶</span>
              </button>
            </div>
          </div>
        </section>

        <section className="px-4 mt-4 space-y-3">
          {!isRepeated && (
            <Link href={`/activate/${sku.id}`} className="btn-primary">
              {t.scan.activate}
            </Link>
          )}
          {isRepeated && (
            <Link href={`/warranty/${sku.id}`} className="btn-primary">
              {t.warranty.card}
            </Link>
          )}
          <Link href={`/device/${sku.id}`} className="btn-secondary">
            {t.scan.bind}
          </Link>
          <Link href={`/shop?sku=${sku.id}`} className="btn-ghost">
            {t.scan.buyParts} ›
          </Link>
        </section>
      </main>
    </PhoneShell>
  );
}
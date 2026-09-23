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
type DocKind = 'manual' | 'video' | 'specsheet' | 'faq';
type DocState =
  | { kind: DocKind; status: 'loading' }
  | { kind: DocKind; status: 'ok'; mime: string; url: string; title: string; sizeBytes?: number }
  | { kind: DocKind; status: 'missing' }; // 后端 404

// v1.3 P0:扫码页拿多语言文档(走前端 /api/public 代理)
async function fetchDoc(skuId: string, kind: DocKind, lang: string): Promise<DocState> {
  const url = `/api/public/sku-document/${encodeURIComponent(skuId)}/${kind}/${lang}`;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.status === 404) return { kind, status: 'missing' };
    if (!res.ok) return { kind, status: 'missing' };
    return {
      kind, status: 'ok',
      mime: res.headers.get('content-type') ?? 'application/octet-stream',
      url, title: kind,
    };
  } catch {
    return { kind, status: 'missing' };
  }
}

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
  // v1.3 P0:多语言文档状态(manual/video 各按当前 UI lang 取一份)
  const [manualDoc, setManualDoc] = useState<DocState>({ kind: 'manual', status: 'loading' });
  const [videoDoc, setVideoDoc] = useState<DocState>({ kind: 'video', status: 'loading' });

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
    setManualDoc({ kind: 'manual', status: 'loading' });
    setVideoDoc({ kind: 'video', status: 'loading' });
    getSku(id)
      .then((s) => {
        setSku(s);
        setState('ok');
        // v1.3 P0:取当前语言的 manual + video 文档(拿不到则隐藏卡片)
        const curLang = (typeof window !== 'undefined'
          ? (window.localStorage.getItem('matoo.lang') ?? 'en')
          : 'en') as string;
        fetchDoc(s.id, 'manual', curLang).then(setManualDoc).catch(() => setManualDoc({ kind: 'manual', status: 'missing' }));
        fetchDoc(s.id, 'video', curLang).then(setVideoDoc).catch(() => setVideoDoc({ kind: 'video', status: 'missing' }));
      })
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
  // P1-3:扫码次数异常提示(>10 次疑似盗扫)
  const scanCount = sku.qr?.scanCount ?? 0;
  const scanCountWarn = scanCount > 10;

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

        {/* P1-3:扫码次数异常提示 */}
        {scanCountWarn && (
          <div role="alert" className="mx-4 mt-3 card p-3 border-red-100 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs flex gap-2">
            <span aria-hidden="true">⚠</span>
            <div>
              <div className="font-semibold">扫码次数异常:已累计 {scanCount} 次</div>
              <div className="mt-0.5 opacity-90">可能为多次复印或盗扫,请联系客服核验真伪。</div>
            </div>
          </div>
        )}

        {/* P1-3:扫码次数小提示 */}
        {!scanCountWarn && scanCount > 0 && (
          <div className="mx-4 mt-2 text-[11px] text-slate-500 text-right">
            累计扫码 {scanCount} 次
          </div>
        )}

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
              {/* 说明书 manual */}
              {manualDoc.status === 'loading' && (
                <div className="w-full flex items-center gap-3 p-2 rounded-lg bg-slate-50 animate-pulse">
                  <div className="w-8 h-8 rounded bg-slate-200" />
                  <div className="flex-1">
                    <div className="h-3 bg-slate-200 rounded w-24" />
                    <div className="h-2 bg-slate-100 rounded w-16 mt-1.5" />
                  </div>
                </div>
              )}
              {manualDoc.status === 'ok' && (
                <a href={manualDoc.url} target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-matoo-light text-matoo flex items-center justify-center text-sm">📕</div>
                    <div className="text-left">
                      <div className="text-sm font-medium">{t.scan.manual}</div>
                      <div className="text-xs text-slate-500">{manualDoc.mime}</div>
                    </div>
                  </div>
                  <span aria-hidden="true" className="text-matoo text-sm">↓</span>
                </a>
              )}
              {manualDoc.status === 'missing' && (
                <div className="w-full flex items-center gap-3 p-2 rounded-lg text-slate-400">
                  <div aria-hidden="true" className="w-8 h-8 rounded bg-slate-100 text-slate-400 flex items-center justify-center text-sm">📕</div>
                  <div className="text-left">
                    <div className="text-sm">{t.scan.manual}</div>
                    <div className="text-xs">{t.scan.manualUnavailable ?? '该语言暂无说明书'}</div>
                  </div>
                </div>
              )}

              {/* 视频 video */}
              {videoDoc.status === 'loading' && (
                <div className="w-full flex items-center gap-3 p-2 rounded-lg bg-slate-50 animate-pulse">
                  <div className="w-8 h-8 rounded bg-slate-200" />
                  <div className="flex-1">
                    <div className="h-3 bg-slate-200 rounded w-20" />
                    <div className="h-2 bg-slate-100 rounded w-12 mt-1.5" />
                  </div>
                </div>
              )}
              {videoDoc.status === 'ok' && (
                <a href={videoDoc.url} target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div aria-hidden="true" className="w-8 h-8 rounded bg-matoo-light text-matoo flex items-center justify-center text-sm">▶</div>
                    <div className="text-left">
                      <div className="text-sm font-medium">{t.scan.video}</div>
                      <div className="text-xs text-slate-500">{videoDoc.mime}</div>
                    </div>
                  </div>
                  <span aria-hidden="true" className="text-matoo text-sm">▶</span>
                </a>
              )}
              {videoDoc.status === 'missing' && (
                <div className="w-full flex items-center gap-3 p-2 rounded-lg text-slate-400">
                  <div aria-hidden="true" className="w-8 h-8 rounded bg-slate-100 text-slate-400 flex items-center justify-center text-sm">▶</div>
                  <div className="text-left">
                    <div className="text-sm">{t.scan.video}</div>
                    <div className="text-xs">{t.scan.videoUnavailable ?? '该语言暂无视频'}</div>
                  </div>
                </div>
              )}
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
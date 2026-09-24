'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { PageLoading, Spinner } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { useT } from '@/lib/i18n';
import { getSku, activateWarranty, uploadInvoicePhoto } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { toast, toastSuccess } from '@/components/Toast';
import { useAbortedFetch } from '@/hooks/useAbortedFetch';
import type { SkuDto } from '@/lib/api/endpoints';
import { getSession } from '@/lib/api/auth-store';

const COUNTRY_TO_CODE: Record<string, string> = {
  'Bangladesh': 'BD',
  'India': 'IN',
  'Pakistan': 'PK',
  'Sri Lanka': 'LK',
  'Nepal': 'NP',
};
const COUNTRY_TO_CCY: Record<string, string> = {
  'Bangladesh': 'BDT',
  'India': 'INR',
  'Pakistan': 'PKR',
  'Sri Lanka': 'LKR',
  'Nepal': 'NPR',
};

export default function ActivatePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useT();
  const id = decodeURIComponent(params.id);

  const [sku, setSku] = useState<SkuDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  // P0 UX-10:onRetry 时递增 reloadKey 触发重新 fetch
  const [reloadKey, setReloadKey] = useState(0);

  const [step, setStep] = useState(1);
  const [country, setCountry] = useState('Bangladesh');
  const [city, setCity] = useState('');
  const [dealer, setDealer] = useState('');
  const [hasInvoice, setHasInvoice] = useState(true); // P1-4:无发票分支
  const [invNo, setInvNo] = useState('');
  // P1-4:默认日期为今天
  const [invDate, setInvDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invAmt, setInvAmt] = useState('');
  const [photo, setPhoto] = useState<{ name: string; size: number; dataUrl: string; file?: File } | null>(null);
  // v1.5 #P1-1:上传返回的公开 URL(用于 warranty.invoicePhotoUrl)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploadProgress, setPhotoUploadProgress] = useState(0);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [agree, setAgree] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    setLoading(true);
    setLoadError(null);
    setReloadKey((k) => k + 1);
  }

  // P0 UX-10:用 useAbortedFetch 取代裸 useEffect+load,组件卸载或 id/reload 变化时取消
  useAbortedFetch((signal) => {
    setLoading(true);
    setLoadError(null);
    getSku(id, { signal })
      .then((s) => { setSku(s); setLoading(false); })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setLoadError(err);
        setLoading(false);
      });
  }, [id, reloadKey]);

  // P0 UX-10:submit 也加 AbortController,组件卸载时取消未完成的请求
  const submitCtrlRef = useRef<AbortController | null>(null);
  useEffect(() => () => { submitCtrlRef.current?.abort(); }, []);

  function pickPhoto(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setPhoto({ name: file.name, size: file.size, dataUrl, file });
      // 重置之前上传结果(选择新文件后老 URL 失效)
      setPhotoUrl(null);
      setPhotoUploadProgress(0);
    };
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    setPhoto(null);
    setPhotoUrl(null);
    setPhotoUploadProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function submit() {
    if (!sku) return;
    const session = getSession();
    if (!session?.token) {
      setSubmitError(new ApiError(401, 'UNAUTHORIZED', t.activate.needLogin));
      return;
    }
    submitCtrlRef.current?.abort();
    const ctrl = new AbortController();
    submitCtrlRef.current = ctrl;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const countryCode = COUNTRY_TO_CODE[country] ?? 'NP';
      const currency = COUNTRY_TO_CCY[country] ?? 'USD';
      // v1.5 #P1-1:有发票且未上传过 → 先 XHR 上传到 /storage/upload(purpose=invoice)
      // 上传失败不阻断后续激活(发票照片非阻塞字段),仅 toast 提示
      let invoicePhotoUrl: string | undefined;
      if (hasInvoice && photo?.file && !photoUrl && !photoUploading) {
        try {
          setPhotoUploading(true);
          const r = await uploadInvoicePhoto(photo.file, {
            signal: ctrl.signal,
            onProgress: (loaded, total) => setPhotoUploadProgress(Math.round((loaded / total) * 100)),
            fileName: photo.file.name,
          });
          setPhotoUrl(r.url);
          invoicePhotoUrl = r.url;
        } catch (upErr) {
          if ((upErr as { name?: string })?.name === 'AbortError') return;
          if (upErr instanceof ApiError) toast(`发票照片上传失败: ${upErr.message}(将继续提交)`, 'error');
        } finally {
          setPhotoUploading(false);
        }
      } else if (photoUrl) {
        invoicePhotoUrl = photoUrl;
      }
      await activateWarranty({
        skuId: sku.id,
        serial: sku.serial,
        batch: sku.batch,
        qrSignature: sku.qr.signature,
        country: countryCode,
        city,
        dealer,
        invoiceNo: hasInvoice && invNo ? invNo : undefined,
        invoiceDate: hasInvoice && invNo ? invDate : undefined,
        invoiceAmt: hasInvoice && invAmt ? Number(invAmt) : undefined,
        invoiceCurrency: hasInvoice ? currency : undefined,
        invoicePhotoUrl,
        policyAccepted: true,
      }, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      toastSuccess(t.activate.submit + ' ✓');
      router.push(`/warranty/${sku.id}`);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setSubmitError(err);
      if (err instanceof ApiError) toast(err.message, 'error');
    } finally {
      if (!ctrl.signal.aborted) setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PhoneShell>
        <TopBar title={t.activate.title} />
        <main className="p-5"><PageLoading /></main>
      </PhoneShell>
    );
  }

  if (loadError || !sku) {
    return (
      <PhoneShell>
        <TopBar title={t.activate.title} />
        <main className="p-4 space-y-3">
          <ErrorBlock error={loadError ?? 'SKU not found'} onRetry={load} />
          <button onClick={() => router.back()} className="btn-secondary">{t.common.back}</button>
        </main>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <TopBar title={t.activate.title} />
      <main className="flex-1 overflow-auto p-4 space-y-4">
        <StepIndicator step={step} total={3} />

        {step === 1 && (
          <div className="space-y-3">
            <h3 className="font-semibold">{t.activate.purchase}</h3>
            <div>
              <label htmlFor="act-country" className="label">{t.activate.country}</label>
              <select id="act-country" className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option>Bangladesh</option>
                <option>India</option>
                <option>Pakistan</option>
                <option>Sri Lanka</option>
                <option>Nepal</option>
              </select>
            </div>
            <div>
              <label htmlFor="act-city" className="label">{t.activate.city}</label>
              <input id="act-city" className="input" placeholder={t.activate.cityPh} value={city} onChange={(e) => setCity(e.target.value)}
                autoComplete="address-level2" />
            </div>
            <div>
              <label htmlFor="act-dealer" className="label">{t.activate.dealer}</label>
              <input id="act-dealer" className="input" placeholder={t.activate.dealerPh} value={dealer} onChange={(e) => setDealer(e.target.value)}
                autoComplete="organization" />
            </div>
            <div className="text-xs text-slate-500 mt-2">{t.activate.serialAuto}:<span className="font-mono">{sku.serial}</span></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h3 className="font-semibold">{t.activate.invoice}</h3>

            {/* P1-4:无发票分支 */}
            <div className="flex items-center justify-between card p-3">
              <div>
                <div className="text-sm font-medium">{hasInvoice ? '有发票' : '无发票 / 已遗失'}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {hasInvoice ? '填写真实发票可享受 INVOICE 策略,保修期自发票日起算' : '将按 MFG_FALLBACK 策略,以生产日期起算保修'}
                </div>
              </div>
              <button
                onClick={() => setHasInvoice((v) => !v)}
                role="switch"
                aria-checked={hasInvoice}
                className={`relative w-11 h-6 rounded-full transition ${hasInvoice ? 'bg-matoo' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 ${hasInvoice ? 'right-0.5' : 'left-0.5'} w-5 h-5 rounded-full bg-white shadow`} />
              </button>
            </div>

            {hasInvoice && (
              <>
                <div>
                  <label htmlFor="act-invoice-no" className="label">{t.activate.invoiceNo}</label>
                  <input id="act-invoice-no" className="input" value={invNo} onChange={(e) => setInvNo(e.target.value)} placeholder="INV-2025-00123"
                    autoComplete="off" maxLength={40} dir="auto" />
                </div>
                <div>
                  <label htmlFor="act-invoice-date" className="label">{t.activate.invoiceDate}</label>
                  <input id="act-invoice-date" type="date" className="input" value={invDate} onChange={(e) => setInvDate(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="act-invoice-amt" className="label">{t.activate.invoiceAmt}{t.activate.invoiceAmtUnit.replace('{c}', COUNTRY_TO_CCY[country] ?? 'USD')}</label>
                  <input id="act-invoice-amt" type="number" inputMode="decimal" step="0.01" min="0" className="input" value={invAmt} onChange={(e) => setInvAmt(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="label">{t.activate.invoicePhoto}</label>
                  <input
                    ref={fileRef}
                    id="act-invoice-photo"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) pickPhoto(f);
                    }}
                    className="hidden"
                  />
                  {photo ? (
                    <div className="card p-2 flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                        <img src={photo.dataUrl} alt={photo.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{photo.name}</div>
                        <div className="text-[11px] text-slate-500">{(photo.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={() => fileRef.current?.click()} className="text-[10px] text-matoo underline">重新</button>
                        <button onClick={clearPhoto} className="text-[10px] text-red-600 underline">移除</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="w-full h-28 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <span aria-hidden="true" className="text-2xl">📷</span>
                      <span className="mt-1">{t.activate.upload}</span>
                      <span className="text-[10px] text-slate-400">JPG/PNG · 最大 5MB</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="font-semibold mb-2">{t.activate.confirm}</h3>
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">SKU</span><span>{sku.sku}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{t.activate.country}</span><span>{country} · {city || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{t.activate.dealer}</span><span>{dealer || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">发票</span><span>{hasInvoice ? `${invNo || '—'} (${invDate})` : '无发票(按生产日期起算)'}</span></div>
                {hasInvoice && <div className="flex justify-between"><span className="text-slate-500">{t.activate.invoiceAmt}</span><span>{invAmt || '—'} {COUNTRY_TO_CCY[country] ?? ''}</span></div>}
                {hasInvoice && photo && <div className="flex justify-between"><span className="text-slate-500">发票照片</span><span className="text-matoo">{photo.name}</span></div>}
              </div>
            </div>
            <div className="text-xs text-slate-500 leading-relaxed bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 p-3 rounded-xl text-amber-800">
              {t.activate.rule}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
              <span>{t.activate.policyOk}</span>
            </label>
            {submitError != null && <ErrorBlock error={submitError} />}
          </div>
        )}

        <div className="pt-2 flex gap-2">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="btn-secondary">{t.common.back}</button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !city : false}
              className="btn-primary flex-1"
            >
              {t.activate.next}
            </button>
          ) : (
            <button onClick={submit} disabled={!agree || submitting} className="btn-primary flex-1 inline-flex items-center justify-center gap-2">
              {submitting ? <Spinner size="sm" /> : null}
              {submitting ? t.common.loading : t.activate.submit}
            </button>
          )}
        </div>
      </main>
    </PhoneShell>
  );
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`step ${step} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 flex-1">
          <div
            aria-current={step === i + 1 ? 'step' : undefined}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              step > i + 1
                ? 'bg-matoo text-white'
                : step === i + 1
                ? 'bg-matoo text-white ring-2 ring-matoo-light'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}
          >
            {step > i + 1 ? '✓' : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`flex-1 h-0.5 rounded ${step > i + 1 ? 'bg-matoo' : 'bg-slate-200 dark:bg-slate-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

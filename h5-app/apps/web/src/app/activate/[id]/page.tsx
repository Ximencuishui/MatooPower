'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { PageLoading, Spinner } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { useT } from '@/lib/i18n';
import { getSku, activateWarranty } from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';
import { toast, toastSuccess } from '@/components/Toast';
import type { SkuDto } from '@/lib/api/endpoints';
import { getSession } from '@/lib/api/auth-store';

export default function ActivatePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useT();
  const id = decodeURIComponent(params.id);

  const [sku, setSku] = useState<SkuDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  const [step, setStep] = useState(1);
  const [country, setCountry] = useState('Bangladesh');
  const [city, setCity] = useState('');
  const [dealer, setDealer] = useState('');
  const [invNo, setInvNo] = useState('');
  const [invDate, setInvDate] = useState('2025-01-15');
  const [invAmt, setInvAmt] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [agree, setAgree] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  function load() {
    setLoading(true);
    setLoadError(null);
    getSku(id)
      .then((s) => { setSku(s); setLoading(false); })
      .catch((err: unknown) => {
        setLoadError(err);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function pickPhoto() {
    setPhoto(`inv-${Math.random().toString(36).slice(2, 7)}`);
  }

  async function submit() {
    if (!sku) return;
    const session = getSession();
    if (!session?.token) {
      setSubmitError(new ApiError(401, 'UNAUTHORIZED', t.activate.needLogin));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const countryCode =
        country === 'Bangladesh' ? 'BD' :
        country === 'India' ? 'IN' :
        country === 'Pakistan' ? 'PK' :
        country === 'Sri Lanka' ? 'LK' : 'NP';
      await activateWarranty({
        skuId: sku.id,
        serial: sku.serial,
        batch: sku.batch,
        qrSignature: sku.qr.signature,
        country: countryCode,
        city,
        dealer,
        invoiceNo: invNo || undefined,
        invoiceDate: invNo ? invDate : undefined,
        invoiceAmt: invAmt ? Number(invAmt) : undefined,
        invoiceCurrency: country === 'Bangladesh' ? 'BDT' : 'USD',
        policyAccepted: true,
      });
      toastSuccess(t.activate.submit + ' ✓');
      router.push(`/warranty/${sku.id}`);
    } catch (err) {
      setSubmitError(err);
      if (err instanceof ApiError) toast(err.message, 'error');
    } finally {
      setSubmitting(false);
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
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{t.activate.step.replace('{n}', String(step)).replace('{t}', '3')}</span>
          <Link href="/warranty-policy" className="text-matoo underline">{t.legal.termsSection2Title} ?</Link>
        </div>

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
            <div>
              <label htmlFor="act-invoice-no" className="label">{t.activate.invoiceNo}</label>
              <input id="act-invoice-no" className="input" value={invNo} onChange={(e) => setInvNo(e.target.value)} placeholder="INV-2025-00123"
                autoComplete="off" maxLength={40} />
            </div>
            <div>
              <label htmlFor="act-invoice-date" className="label">{t.activate.invoiceDate}</label>
              <input id="act-invoice-date" type="date" className="input" value={invDate} onChange={(e) => setInvDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="act-invoice-amt" className="label">{t.activate.invoiceAmt}{t.activate.invoiceAmtUnit.replace('{c}', country === 'Bangladesh' ? 'BDT' : 'USD')}</label>
              <input id="act-invoice-amt" type="number" inputMode="decimal" step="0.01" min="0" className="input" value={invAmt} onChange={(e) => setInvAmt(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label htmlFor="act-invoice-photo" className="label">{t.activate.invoicePhoto}</label>
              <button id="act-invoice-photo" onClick={pickPhoto} className="w-full h-28 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                {photo ? (
                  <div className="flex items-center gap-2 text-matoo">
                    <span aria-hidden="true">📄</span><span className="font-mono">{photo}.jpg</span>
                  </div>
                ) : (
                  <>
                    <span aria-hidden="true" className="text-2xl">⬆</span>
                    <span className="mt-1">{t.activate.upload}</span>
                    <span className="text-xs text-slate-400">{t.activate.uploadTip}</span>
                  </>
                )}
              </button>
            </div>
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
                <div className="flex justify-between"><span className="text-slate-500">{t.activate.invoiceNo}</span><span className="font-mono">{invNo || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{t.activate.invoiceDate}</span><span>{invDate}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{t.activate.invoiceAmt}</span><span>{invAmt || '—'}</span></div>
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

        <div className="pt-2">
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} className="btn-primary">
              {t.activate.next}
            </button>
          ) : (
            <button onClick={submit} disabled={!agree || submitting} className="btn-primary inline-flex items-center justify-center gap-2">
              {submitting ? <Spinner size="sm" /> : null}
              {submitting ? t.common.loading : t.activate.submit}
            </button>
          )}
        </div>
      </main>
    </PhoneShell>
  );
}

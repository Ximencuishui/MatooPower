'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { Spinner } from '@/components/Spinner';
import { useT } from '@/lib/i18n';
import { bulkActivateDealer } from '@/lib/api/operations';
import type { BulkActivateItem } from '@/lib/api/endpoints';
import { getSession } from '@/lib/api/auth-store';
import { ApiError } from '@/lib/api/client';
import { toast, toastSuccess } from '@/components/Toast';

// P1-2:演示期后端无 dealer pickup,前端保留硬编码清单作 demo + 后端校验
const DEMO_BATCH: Array<{ sku: string; serial: string }> = [
  { sku: 'MAT-12V200Ah', serial: 'SN24B0801A0001' },
  { sku: 'MAT-12V300Ah', serial: 'SN24B0801A0004' },
  { sku: 'MAT-12V200Ah', serial: 'SN24B0801A0003' },
  { sku: 'MAT-12V200Ah', serial: 'SN24B0801A0002' },
  { sku: 'MAT-12V200Ah', serial: 'SN24B0801A0005' },
];

type Row = { sku: string; serial: string; selected: boolean; status?: 'ok' | 'fail'; errMsg?: string };

export default function DealerBatchPage() {
  const { t } = useT();
  const router = useRouter();

  const [items, setItems] = useState<Row[]>(DEMO_BATCH.map((it) => ({ ...it, selected: true })));
  const [customerPhone, setCustomerPhone] = useState('+88017220003');
  const [customerName, setCustomerName] = useState('Customer Default');
  const [perItemCustomer, setPerItemCustomer] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState('SH-2025-0042');
  const [invoiceDate, setInvoiceDate] = useState('2025-03-15');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<unknown>(null);

  function toggle(i: number) {
    setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, selected: !it.selected } : it));
  }

  const selected = items.filter((it) => it.selected);

  async function submit() {
    if (selected.length === 0) return;
    const session = getSession();
    if (!session?.token) {
      setError(new ApiError(401, 'UNAUTHORIZED', t.dealer.needLogin));
      return;
    }
    setError(null);
    setSubmitting(true);
    setProgress({ done: 0, total: selected.length });

    const reqItems: BulkActivateItem[] = selected.map((it) => ({
      qrId: it.serial,
      customerPhone: customerPhone,
      customerName,
      invoiceNo,
      invoiceDate,
    }));

    // 后端目前是原子批量:逐项标 ok/fail 需要等 P1-2 后端单条端点。先全量提交,失败回标。
    setProgress({ done: 0, total: selected.length });
    try {
      const r = await bulkActivateDealer({ shipmentInvoiceNo: invoiceNo, items: reqItems });
      setItems((arr) => arr.map((it) => it.selected ? { ...it, status: 'ok' } : it));
      setProgress({ done: r.count, total: selected.length });
      toastSuccess(t.dealer.submitted.replace('{n}', String(r.count)) + ' ✓');
    } catch (e) {
      // 单条失败标记:目前因批量是原子,全部回滚,把用户选的全部标 fail
      setItems((arr) => arr.map((it) => it.selected ? { ...it, status: 'fail', errMsg: e instanceof Error ? e.message : '' } : it));
      const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.dealer.submitFailed);
      setError(e);
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const okCount = items.filter((it) => it.status === 'ok').length;
  const failCount = items.filter((it) => it.status === 'fail').length;

  return (
    <PhoneShell>
      <TopBar title={t.dealer.title} />
      <main className="flex-1 overflow-auto pb-6">
        <div className="p-4">
          <div className="card p-3 bg-gradient-to-br from-matoo-light to-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-matoo text-white flex items-center justify-center font-bold">D</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Dhaka Power Hub</div>
              <div className="text-[11px] text-slate-500">{t.dealer.role}:{t.dealer.roleVal}</div>
            </div>
            <span className="chip chip-green" role="status">✓ {t.dealer.verified}</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 px-1">{t.dealer.desc}</p>
        </div>

        <section className="px-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">{t.dealer.pickupCount.replace('{n}', String(items.length))}</h3>
            <Link href="/dealer/dashboard" className="text-xs text-matoo">{t.dealer.addMore} ›</Link>
          </div>
          <div className="card divide-y dark:divide-slate-700">
            {items.map((it, i) => (
              <button
                key={i}
                onClick={() => toggle(i)}
                role="checkbox"
                aria-checked={it.selected}
                aria-label={`${it.sku} ${it.serial}`}
                className={`w-full flex items-center gap-3 p-3 text-left ${
                  it.status === 'fail' ? 'bg-red-50 dark:bg-red-950/30' : ''
                }`}
              >
                <span aria-hidden="true" className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${it.selected ? 'bg-matoo border-matoo text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                  {it.selected ? '✓' : ''}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{it.sku}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{it.serial}</div>
                  {it.status === 'fail' && it.errMsg && (
                    <div className="text-[10px] text-red-600 dark:text-red-400 mt-0.5 truncate" title={it.errMsg}>{it.errMsg}</div>
                  )}
                </div>
                {it.status === 'ok' && <span className="chip chip-green text-[10px]">✓</span>}
                {it.status === 'fail' && <span className="chip chip-red text-[10px]">!</span>}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            ⚠ {t.dealer.mockNote}
          </p>
        </section>

        <section className="px-4 mt-4 space-y-3">
          <h3 className="font-semibold">{t.dealer.customer}</h3>
          <div>
            <label htmlFor="d-cust-phone" className="label">{t.dealer.customerPhone}</label>
            <input id="d-cust-phone" type="tel" inputMode="tel" autoComplete="tel"
              className="input" placeholder="+8801xxxxxxxxx" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
          <div>
            <label htmlFor="d-cust-name" className="label">{t.dealer.customerName}</label>
            <input id="d-cust-name" type="text" autoComplete="name"
              className="input" placeholder={t.dealer.customerName} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>

          <div>
            <label htmlFor="d-inv-no" className="label">{t.dealer.invoiceNo}</label>
            <input id="d-inv-no" type="text" autoComplete="off" maxLength={40}
              className="input" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </div>
          <div>
            <label htmlFor="d-inv-date" className="label">{t.dealer.invoiceDate}</label>
            <input id="d-inv-date" type="date" className="input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
        </section>

        {error != null && <div className="mx-4 mt-4 text-xs text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300 p-3 rounded-xl">{(error as Error).message ?? t.dealer.submitFailed}</div>}

        {/* P1-9:进度条 + 失败项高亮(上面已加) */}
        {submitting && progress.total > 0 && (
          <div className="px-4 mt-3">
            <div className="text-xs text-slate-500 mb-1">{progress.done} / {progress.total}</div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-2 bg-matoo transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          </div>
        )}

        <section className="px-4 mt-6">
          <button
            onClick={submit}
            disabled={submitting || selected.length === 0}
            className="btn-primary inline-flex items-center justify-center gap-2"
          >
            {submitting ? <Spinner size="sm" /> : null}
            {submitting ? t.dealer.submitting : `${t.dealer.submit} (${selected.length})`}
          </button>
          {(okCount > 0 || failCount > 0) && !submitting && (
            <div className="card p-3 mt-3 bg-matoo-light text-matoo-dark text-sm" role="status">
              ✓ {t.dealer.submitted.replace('{n}', String(okCount))}
              {failCount > 0 && <span className="ml-2 text-red-600 dark:text-red-300">· 失败 {failCount}</span>}
              <div className="mt-2">
                <button onClick={() => router.push('/dealer/dashboard')} className="text-matoo underline text-sm">{t.dealer.viewDashboard}</button>
              </div>
            </div>
          )}
        </section>
      </main>
    </PhoneShell>
  );
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar } from '@/components/TopBar';
import { useT } from '@/lib/i18n';
import { bulkActivateDealer } from '@/lib/api/operations';
import type { BulkActivateItem } from '@/lib/api/endpoints';
import { getSession } from '@/lib/api/auth-store';
import { ApiError } from '@/lib/api/client';

type Row = { sku: string; serial: string; selected: boolean; knownActivated?: boolean };

const DEMO_BATCH: Omit<Row, 'selected'>[] = [
  { sku: 'MAT-12V200Ah', serial: 'SN24B0801A0001' },
  { sku: 'MAT-12V300Ah', serial: 'SN24B0801A0004' },
  { sku: 'MAT-12V200Ah', serial: 'SN24B0801A0003' },
  { sku: 'MAT-12V200Ah', serial: 'SN24B0801A0002' },
  { sku: 'MAT-12V200Ah', serial: 'SN24B0801A0005' }, // 演示：未入库
];

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
  const [submitted, setSubmitted] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(i: number) {
    setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, selected: !it.selected } : it));
  }

  const selected = items.filter((it) => it.selected);

  function submit() {
    if (selected.length === 0) return;
    const session = getSession();
    if (!session?.token) {
      setError(t.dealer.needLogin);
      return;
    }
    setError(null);
    setSubmitting(true);
    const items: BulkActivateItem[] = selected.map((it) => ({
      qrId: it.serial,
      customerPhone: perItemCustomer ? customerPhone : customerPhone,
      customerName,
      invoiceNo: invoiceNo,
      invoiceDate,
    }));
    bulkActivateDealer({ shipmentInvoiceNo: invoiceNo, items })
      .then((r) => setSubmitted({ count: r.count }))
      .catch((e: unknown) => {
        setError(e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.dealer.submitFailed));
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <PhoneShell>
      <TopBar title={t.dealer.title} />
      <main className="flex-1 overflow-auto pb-6">
        {/* 经销商身份头 */}
        <div className="p-4">
          <div className="card p-3 bg-gradient-to-br from-matoo-light to-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-matoo text-white flex items-center justify-center font-bold">D</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Dhaka Power Hub</div>
              <div className="text-[11px] text-slate-500">{t.dealer.role}：{t.dealer.roleVal}</div>
            </div>
            <span className="chip chip-green" role="status">✓ {t.dealer.verified}</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 px-1">{t.dealer.desc}</p>
        </div>

        {/* 出货批次清单 */}
        <section className="px-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">{t.dealer.pickupCount.replace('{n}', String(items.length))}</h3>
            <Link href="/dealer/dashboard" className="text-xs text-matoo">{t.dealer.addMore} ›</Link>
          </div>
          <div className="card divide-y">
            {items.map((it, i) => (
              <button
                key={i}
                onClick={() => toggle(i)}
                role="checkbox"
                aria-checked={it.selected}
                aria-label={`${it.sku} ${it.serial}`}
                className="w-full flex items-center gap-3 p-3 text-left"
              >
                <span aria-hidden="true" className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${it.selected ? 'bg-matoo border-matoo text-white' : 'border-slate-300'}`}>
                  {it.selected ? '✓' : ''}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{it.sku}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{it.serial}</div>
                </div>
                {it.knownActivated && <span className="chip chip-gray text-[10px]">{t.dealer.activated}</span>}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            ⚠ {t.dealer.mockNote}
          </p>
        </section>

        {/* 客户 + 发票 */}
        <section className="px-4 mt-4 space-y-3">
          <h3 className="font-semibold">{t.dealer.customer}</h3>
          <div>
            <label htmlFor="d-cust-phone" className="label">{t.dealer.customerPhone}</label>
            <input id="d-cust-phone" type="tel" className="input" placeholder="+8801xxxxxxxxx" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
          <div>
            <label htmlFor="d-cust-name" className="label">{t.dealer.customerName}</label>
            <input id="d-cust-name" className="input" placeholder={t.dealer.customerName} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>

          <div>
            <label htmlFor="d-inv-no" className="label">{t.dealer.invoiceNo}</label>
            <input id="d-inv-no" className="input" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </div>
          <div>
            <label htmlFor="d-inv-date" className="label">{t.dealer.invoiceDate}</label>
            <input id="d-inv-date" type="date" className="input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
        </section>

        {/* 错误 + 提交 */}
        {error && <div role="alert" className="mx-4 mt-4 text-xs text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>}

        <section className="px-4 mt-6">
          <button
            onClick={submit}
            disabled={submitting || selected.length === 0}
            className="btn-primary"
          >
            {submitting ? t.dealer.submitting : `${t.dealer.submit}（${selected.length}）`}
          </button>
          {submitted !== null && (
            <div className="card p-3 mt-3 bg-matoo-light text-matoo-dark text-sm" role="status">
              ✓ {t.dealer.submitted.replace('{n}', String(submitted.count))}
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
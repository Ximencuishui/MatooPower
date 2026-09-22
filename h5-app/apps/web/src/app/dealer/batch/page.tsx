'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar, DealerBreadcrumb } from '@/components/TopBar';
import { TabBar } from '@/components/TabBar';
import { Spinner } from '@/components/Spinner';
import { useT } from '@/lib/i18n';
import { bulkActivateDealer } from '@/lib/api/operations';
import type { BulkActivateItem } from '@/lib/api/endpoints';
import { getSession } from '@/lib/api/auth-store';
import { ApiError } from '@/lib/api/client';
import { toast, toastSuccess } from '@/components/Toast';
import { useRequireRole, RoleGuardView } from '@/hooks/useRequireRole';

// P1-2:演示期后端无 dealer pickup,前端保留硬编码清单作 demo + 后端校验
const DEMO_BATCH: Array<{ sku: string; serial: string }> = [
  { sku: 'MAT-12V200Ah', serial: 'SN24B0801A0001' },
  { sku: 'MAT-12V300Ah', serial: 'SN24B0801A0004' },
  { sku: 'MAT-12V200Ah', serial: 'SN24B0801A0003' },
  { sku: 'MAT-12V200Ah', serial: 'SN24B0801A0002' },
  { sku: 'MAT-12V200Ah', serial: 'SN24B0801A0005' },
];

type RowStatus = 'idle' | 'pending' | 'ok' | 'fail';
type Row = { sku: string; serial: string; selected: boolean; status: RowStatus; errMsg?: string };

export default function DealerBatchPage() {
  const { t } = useT();
  const router = useRouter();
  const guard = useRequireRole(['dealer', 'admin']);

  const [items, setItems] = useState<Row[]>(DEMO_BATCH.map((it) => ({ sku: it.sku, serial: it.serial, selected: true, status: 'idle' })));
  const [customerPhone, setCustomerPhone] = useState('+88017220003');
  const [customerName, setCustomerName] = useState('Customer Default');
  const [perItemCustomer, setPerItemCustomer] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState('SH-2025-0042');
  // P1-4:默认日期为今天
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<unknown>(null);

  // UX-23:跟踪每行上一状态,变化时给一行脉冲动画 (status-pulse-ok / status-pulse-fail)
  const prevStatus = useRef<Map<number, RowStatus>>(new Map());
  const [pulseKeys, setPulseKeys] = useState<{ idx: number; kind: RowStatus } | null>(null);
  useEffect(() => {
    let changed: { idx: number; kind: RowStatus } | null = null;
    items.forEach((it, i) => {
      const prev = prevStatus.current.get(i);
      if (prev && prev !== it.status && (it.status === 'ok' || it.status === 'fail')) {
        changed = { idx: i, kind: it.status };
      }
      prevStatus.current.set(i, it.status);
    });
    if (changed) {
      setPulseKeys(changed);
      const t = setTimeout(() => setPulseKeys(null), 650);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function toggle(i: number) {
    setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, selected: !it.selected, status: it.status === 'pending' || it.status === 'ok' || it.status === 'fail' ? it.status : 'idle' } : it));
  }

  function resetAll() {
    setItems((arr) => arr.map((it) => ({ ...it, status: 'idle', errMsg: undefined })));
  }

  const selected = items.filter((it) => it.selected);

  // P1-9:进度条实时 — 单条提交循环,每条更新状态
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
    // 先把所有选中项标 pending
    setItems((arr) => arr.map((it) => it.selected ? { ...it, status: 'pending', errMsg: undefined } : it));

    let okCount = 0;
    let failCount = 0;

    // 逐项提交:失败不阻塞后续,收集每条 error
    const snapshot = items;
    for (let idx = 0; idx < snapshot.length; idx++) {
      const it = snapshot[idx];
      if (!it || !it.selected) continue;
      try {
        await bulkActivateDealer({
          shipmentInvoiceNo: invoiceNo,
          items: [{ qrId: it.serial, customerPhone, customerName, invoiceNo, invoiceDate }],
        });
        setItems((arr) => arr.map((x, i) => i === idx ? { ...x, status: 'ok', errMsg: undefined } : x));
        okCount++;
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : t.dealer.submitFailed);
        setItems((arr) => arr.map((x, i) => i === idx ? { ...x, status: 'fail', errMsg: msg } : x));
        failCount++;
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }

    setSubmitting(false);
    if (failCount === 0) {
      toastSuccess(t.dealer.submitted.replace('{n}', String(okCount)) + ' ✓');
    } else if (okCount > 0) {
      toast(`已成功 ${okCount} 条,失败 ${failCount} 条`, 'info');
    } else {
      const msg = selected[0]?.errMsg ?? t.dealer.submitFailed;
      toast(msg, 'error');
    }
  }

  const okCount = items.filter((it) => it.status === 'ok').length;
  const failCount = items.filter((it) => it.status === 'fail').length;
  const pendingCount = items.filter((it) => it.status === 'pending').length;

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title={t.dealer.title} />;
  }

  return (
    <PhoneShell>
      <TopBar title={t.dealer.title} leftExtra={<DealerBreadcrumb />} />
      <main className="flex-1 overflow-auto pb-6">
        <div className="p-4">
          <div className="card p-3 bg-gradient-to-br from-matoo-light to-white dark:from-matoo/20 dark:to-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-matoo text-white flex items-center justify-center font-bold">D</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{getSession()?.displayName ?? t.dealer.title}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.dealer.role}:{t.dealer.roleVal}</div>
            </div>
            <span className="chip chip-green" role="status">✓ {t.dealer.verified}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 px-1">{t.dealer.desc}</p>
        </div>

        <section className="px-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">{t.dealer.pickupCount.replace('{n}', String(items.length))}</h3>
            <Link href="/dealer/dashboard" className="text-xs text-matoo">{t.dealer.addMore} ›</Link>
          </div>
          <div className="card divide-y dark:divide-slate-700">
            {items.map((it, i) => {
              // UX-23:状态变化触发脉冲;首次渲染错落入场
              const pulseClass = pulseKeys?.idx === i
                ? (pulseKeys.kind === 'ok' ? 'status-pulse-ok' : 'status-pulse-fail')
                : '';
              return (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  role="checkbox"
                  aria-checked={it.selected}
                  aria-label={`${it.sku} ${it.serial}`}
                  disabled={submitting}
                  style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                  className={`w-full flex items-center gap-3 p-3 text-left slide-in-up will-change-transform ${pulseClass} ${
                    it.status === 'fail' ? 'bg-red-50 dark:bg-red-950/30' :
                    it.status === 'ok' ? 'bg-matoo-light/30 dark:bg-matoo/10' : ''
                  }`}
                >
                  <span aria-hidden="true" className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${it.selected ? 'bg-matoo border-matoo text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                    {it.selected ? '✓' : ''}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{it.sku}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{it.serial}</div>
                    {it.status === 'fail' && it.errMsg && (
                      <div className="text-[10px] text-red-600 dark:text-red-400 mt-0.5 truncate" title={it.errMsg}>{it.errMsg}</div>
                    )}
                  </div>
                  {it.status === 'pending' && <Spinner size="sm" />}
                  {it.status === 'ok' && <span className="chip chip-green text-[10px]" aria-label="ok">✓</span>}
                  {it.status === 'fail' && <span className="chip chip-red text-[10px]" aria-label="failed">!</span>}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            <span aria-hidden="true">⚠</span> {t.dealer.mockNote}
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
            <input id="d-cust-name" type="text" autoComplete="name" dir="auto"
              className="input" placeholder={t.dealer.customerName} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>

          <div>
            <label htmlFor="d-inv-no" className="label">{t.dealer.invoiceNo}</label>
            <input id="d-inv-no" type="text" autoComplete="off" maxLength={40} dir="auto"
              className="input" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </div>
          <div>
            <label htmlFor="d-inv-date" className="label">{t.dealer.invoiceDate}</label>
            <input id="d-inv-date" type="date" className="input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
        </section>

        {error != null && <div className="mx-4 mt-4 text-xs text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300 p-3 rounded-xl">{(error as Error).message ?? t.dealer.submitFailed}</div>}

        {/* P1-9:进度条实时更新 */}
        {submitting && progress.total > 0 && (
          <div className="px-4 mt-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex justify-between">
              <span>{progress.done} / {progress.total}</span>
              <span>{Math.round((progress.done / progress.total) * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden" role="progressbar" aria-valuenow={progress.done} aria-valuemin={0} aria-valuemax={progress.total}>
              <div className="h-2 bg-matoo transition-all duration-300" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
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
          {(okCount > 0 || failCount > 0 || pendingCount > 0) && !submitting && (
            <div className="card p-3 mt-3 text-sm space-y-1" role="status">
              {okCount > 0 && <div className="text-matoo-dark dark:text-matoo-light"><span aria-hidden="true">✓</span> 成功 {okCount} 条</div>}
              {failCount > 0 && <div className="text-red-600 dark:text-red-300"><span aria-hidden="true">✗</span> 失败 {failCount} 条</div>}
              <div className="flex gap-2 mt-2">
                <button onClick={() => router.push('/dealer/dashboard')} className="text-matoo underline text-sm flex-1">{t.dealer.viewDashboard}</button>
                {(failCount > 0) && (
                  <button onClick={resetAll} className="text-slate-500 dark:text-slate-400 underline text-sm flex-1">重置状态</button>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* UX-22:经销商页面加底部 TabBar,与 customer 共用,导航不再断 */}
      <TabBar />
    </PhoneShell>
  );
}
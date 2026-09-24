'use client';
// v1.5 #P0-3:经销商提货 - 持久化到后端 /dealer/pickups(替代 localStorage)
// admin 视域下也能看到自己触发的提货(走 user.dealerId)

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar, DealerBreadcrumb } from '@/components/TopBar';
import { LangSwitch } from '@/components/LangSwitch';
import { EmptyState } from '@/components/EmptyState';
import { PageLoading, Spinner } from '@/components/Spinner';
import { ErrorBlock } from '@/components/ErrorBlock';
import { useT } from '@/lib/i18n';
import { useRequireRole, RoleGuardView } from '@/hooks/useRequireRole';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { toast } from '@/components/Toast';
import { ApiError } from '@/lib/api/client';
import {
  listDealerPickups,
  createDealerPickup,
  deleteDealerPickup,
  type DealerPickup,
} from '@/lib/api/operations';
import { useAbortedFetch } from '@/hooks/useAbortedFetch';

export default function DealerPickupPage() {
  const { t } = useT();
  const { formatDate } = useLocaleFormat();
  const guard = useRequireRole(['dealer', 'admin']);

  const [pickups, setPickups] = useState<DealerPickup[] | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [shipmentDate, setShipmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rawText, setRawText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useAbortedFetch((signal) => {
    setLoadError(null);
    listDealerPickups(undefined, { signal })
      .then((r) => setPickups(r.items))
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setLoadError(err instanceof Error ? err : new Error(String(err)));
      });
  }, [reloadKey]);

  async function addPickup() {
    const lines = rawText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) { toast('请粘贴至少一行 SKU / 序列号', 'error'); return; }
    if (!invoiceNo.trim()) { toast('请填写出厂发票号', 'error'); return; }
    const items: { sku: string; serial: string }[] = [];
    for (const line of lines) {
      const parts = line.split(/[,\t]/).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        items.push({ sku: parts[0], serial: parts[1] });
      } else {
        items.push({ sku: 'MAT-12V200Ah', serial: parts[0] ?? line });
      }
    }
    setSubmitting(true);
    try {
      const r = await createDealerPickup({
        shipmentInvoiceNo: invoiceNo.trim(),
        shipmentDate,
        items,
      });
      toast(`已登记提货批次 ${items.length} 件 ✓ (id=${r.pickup.id})`, 'success');
      setInvoiceNo('');
      setRawText('');
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
      else toast('登记失败,请稍后重试', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteBatch(id: string) {
    if (!window.confirm(`删除提货批次 ${id}?(已激活的件会被阻止)`)) return;
    try {
      await deleteDealerPickup(id);
      toast('已删除批次', 'success');
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError) toast(err.message, 'error');
      else toast('删除失败', 'error');
    }
  }

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title="提货管理" />;
  }

  return (
    <PhoneShell>
      <TopBar title="提货管理" leftExtra={<DealerBreadcrumb />} right={<LangSwitch />} />
      <main className="flex-1 overflow-auto p-4 space-y-4">
        <div className="card p-4 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 text-emerald-900 dark:text-emerald-300 text-xs flex gap-2">
          <span aria-hidden="true">✓</span>
          <div>
            提货记录已接入后端 <code className="font-mono">/dealer/pickups</code>(v1.5),跨设备共享;可与批量激活联用。
          </div>
        </div>

        <section className="space-y-3">
          <div>
            <label htmlFor="pk-inv" className="label">出厂发票号</label>
            <input
              id="pk-inv"
              className="input"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="SH-2025-0042"
              dir="auto"
            />
          </div>
          <div>
            <label htmlFor="pk-date" className="label">发货日期</label>
            <input
              id="pk-date"
              type="date"
              className="input"
              value={shipmentDate}
              onChange={(e) => setShipmentDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pk-raw" className="label">
              SKU + 序列号(每行一条,<code className="font-mono">SKU,Serial</code> 或纯序列号)
            </label>
            <textarea
              id="pk-raw"
              className="input min-h-[140px] py-2 font-mono text-xs"
              placeholder={'MAT-12V200Ah,SN24B0801A0001\nMAT-12V200Ah,SN24B0801A0002'}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              dir="auto"
            />
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              支持从 Excel / 供应商发货单复制粘贴
            </div>
          </div>
          <button onClick={addPickup} disabled={submitting} className="btn-primary inline-flex items-center gap-2">
            {submitting ? <Spinner size="sm" /> : null}
            {submitting ? '提交中...' : '登记提货'}
          </button>
        </section>

        <section className="mt-4">
          <h3 className="font-semibold mb-2">历史提货 {pickups && `(${pickups.length})`}</h3>
          {loadError && <ErrorBlock error={loadError} onRetry={() => setReloadKey((k) => k + 1)} />}
          {!loadError && pickups === null && <PageLoading />}
          {!loadError && pickups && pickups.length === 0 && <EmptyState icon="📦" title="暂无提货记录" />}
          <div className="space-y-2">
            {pickups && pickups.map((p) => {
              const activated = p.items.filter((it) => it.activated === 1).length;
              const total = p.items.length;
              return (
                <div key={p.id} className="card p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="text-sm font-semibold">发票号 {p.shipmentInvoiceNo}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatDate(p.shipmentDate)} · {activated}/{total} 已激活 · 登记 {formatDate(p.createdAt)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={{ pathname: '/dealer/batch', query: { invoice: p.shipmentInvoiceNo } }}
                        className="text-xs text-matoo underline"
                      >
                        去激活 →
                      </Link>
                      <button
                        onClick={() => deleteBatch(p.id)}
                        disabled={activated > 0}
                        title={activated > 0 ? '已激活的件无法删除' : undefined}
                        className="text-xs text-red-600 dark:text-red-400 underline disabled:opacity-50"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono max-h-20 overflow-y-auto">
                    {p.items.slice(0, 10).map((it) => (
                      <div key={it.id}>
                        {it.sku} · {it.serial} {it.activated === 1 ? '✓' : ''}
                      </div>
                    ))}
                    {p.items.length > 10 && <div className="text-slate-400 dark:text-slate-500">... 另 {p.items.length - 10} 件</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </PhoneShell>
  );
}
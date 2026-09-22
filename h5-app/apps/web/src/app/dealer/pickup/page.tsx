'use client';
// Dealer pickup:经销商手动登记提货批次(演示期本地持久化 + 可进入批量激活)
// 真实生产期由后端 /dealer/pickups 提供批量录入与查询

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneShell';
import { TopBar, DealerBreadcrumb } from '@/components/TopBar';
import { LangSwitch } from '@/components/LangSwitch';
import { EmptyState } from '@/components/EmptyState';
import { useT } from '@/lib/i18n';
import { useRequireRole, RoleGuardView } from '@/hooks/useRequireRole';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { toast } from '@/components/Toast';

type PickupBatch = {
  id: string;
  shipmentInvoiceNo: string;
  shipmentDate: string;
  createdAt: string;
  items: { sku: string; serial: string; activated?: boolean }[];
};

const STORAGE_KEY = 'matoo.dealer.pickups';

function loadPickups(): PickupBatch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PickupBatch[]) : [];
  } catch {
    return [];
  }
}

function savePickups(items: PickupBatch[]) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}

export default function DealerPickupPage() {
  const { t } = useT();
  const { formatDate } = useLocaleFormat();
  const guard = useRequireRole(['dealer', 'admin']);

  const [pickups, setPickups] = useState<PickupBatch[]>([]);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [shipmentDate, setShipmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rawText, setRawText] = useState('');

  useEffect(() => {
    setPickups(loadPickups());
  }, []);

  function addPickup() {
    const lines = rawText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) { toast('请粘贴至少一行 SKU / 序列号', 'error'); return; }
    if (!invoiceNo.trim()) { toast('请填写出厂发票号', 'error'); return; }
    const items: { sku: string; serial: string }[] = [];
    for (const line of lines) {
      // 支持 SKU,Serial  或  SKU:Serial  或纯序列号
      const parts = line.split(/[,\t]/).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        items.push({ sku: parts[0], serial: parts[1] });
      } else {
        items.push({ sku: 'MAT-12V200Ah', serial: parts[0] ?? line });
      }
    }
    const next: PickupBatch = {
      id: `pickup-${Date.now()}`,
      shipmentInvoiceNo: invoiceNo.trim(),
      shipmentDate,
      createdAt: new Date().toISOString(),
      items,
    };
    const all = [next, ...pickups];
    setPickups(all);
    savePickups(all);
    setInvoiceNo('');
    setRawText('');
    toast(`已添加提货批次 ${items.length} 件 ✓`, 'success');
  }

  function deleteBatch(id: string) {
    const all = pickups.filter((p) => p.id !== id);
    setPickups(all);
    savePickups(all);
  }

  if (guard.status !== 'ok') {
    return <RoleGuardView state={guard} title="提货管理" />;
  }

  return (
    <PhoneShell>
      <TopBar title="提货管理" leftExtra={<DealerBreadcrumb />} right={<LangSwitch />} />
      <main className="flex-1 overflow-auto p-4 space-y-4">
        <div className="card p-4 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 text-amber-900 dark:text-amber-300 text-xs flex gap-2">
          <span aria-hidden="true">ℹ</span>
          <div>
            演示期提货记录保存在本设备 localStorage,生产期将改为后端 /dealer/pickups 持久化。
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
          <button onClick={addPickup} className="btn-primary">登记提货</button>
        </section>

        <section className="mt-4">
          <h3 className="font-semibold mb-2">历史提货 ({pickups.length})</h3>
          {pickups.length === 0 && <EmptyState icon="📦" title="暂无提货记录" />}
          <div className="space-y-2">
            {pickups.map((p) => (
              <div key={p.id} className="card p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-sm font-semibold">发票号 {p.shipmentInvoiceNo}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formatDate(p.shipmentDate)} · {p.items.length} 件 · 登记 {formatDate(p.createdAt)}
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
                      onClick={() => {
                        if (window.confirm(`删除批次 ${p.shipmentInvoiceNo}?`)) deleteBatch(p.id);
                      }}
                      className="text-xs text-red-600 dark:text-red-400 underline"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono max-h-20 overflow-y-auto">
                  {p.items.slice(0, 10).map((it, i) => (
                    <div key={i}>{it.sku} · {it.serial}</div>
                  ))}
                  {p.items.length > 10 && <div className="text-slate-400 dark:text-slate-500">... 另 {p.items.length - 10} 件</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </PhoneShell>
  );
}
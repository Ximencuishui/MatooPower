'use client';
// v1.3 P0:SKU 管理 4 Tab 导航

import { useT } from '@/lib/i18n';

export type AdminSkuTab = 'list' | 'batches' | 'documents' | 'qr';

interface AdminSkuTabsProps {
  active: AdminSkuTab;
  onChange: (tab: AdminSkuTab) => void;
}

export function AdminSkuTabs({ active, onChange }: AdminSkuTabsProps) {
  const { t } = useT();
  const tabs: Array<{ key: AdminSkuTab; label: string }> = [
    { key: 'list', label: (t as any).adminSku?.tabs?.list ?? 'SKU 列表' },
    { key: 'batches', label: (t as any).adminSku?.tabs?.batches ?? '批次管理' },
    { key: 'documents', label: (t as any).adminSku?.tabs?.documents ?? '文档管理' },
    { key: 'qr', label: (t as any).adminSku?.tabs?.qr ?? 'QR 批量' },
  ];
  return (
    <nav className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto" aria-label="SKU 管理 Tab">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition ${
            active === tab.key
              ? 'border-matoo text-matoo'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          aria-current={active === tab.key ? 'page' : undefined}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
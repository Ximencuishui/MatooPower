'use client';
// ExportCsvButton — 通用 CSV 导出按钮
// 用法:
//   <ExportCsvButton
//     filename="admin-sku-2026-09-21"
//     fetch={() => downloadAdminSkuCsv()}
//     count={items?.length ?? 0}
//     label={t.common.exportCsv}
//   />
import { useState } from 'react';
import { saveBlob } from '@/lib/api/operations';
import { toast, toastError, toastSuccess } from '@/components/Toast';
import { useT } from '@/lib/i18n';

interface Props {
  filename: string;
  fetch: () => Promise<Blob>;
  count?: number;             // 用于提示"导出 N 条";0 则禁用
  label?: string;             // 默认 t.common.exportCsv
  className?: string;
}

export function ExportCsvButton({ filename, fetch: fetchCsv, count, label, className }: Props) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const disabled = busy || count === 0;

  async function onClick() {
    if (disabled) {
      if (count === 0) toast(t.common.exportCsvEmpty);
      return;
    }
    setBusy(true);
    try {
      const blob = await fetchCsv();
      saveBlob(blob, `${filename}.csv`);
      toastSuccess(t.common.exportCsvDone.replace('{n}', String(count ?? 0)));
    } catch (e) {
      toastError(`${t.common.exportCsvFailed}: ${(e as Error).message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      className={className ?? 'btn-secondary text-xs px-2 py-1 inline-flex items-center gap-1'}
      title={count === 0 ? t.common.exportCsvEmpty : undefined}
    >
      <span aria-hidden="true">⬇</span>
      <span>{label ?? t.common.exportCsv}</span>
    </button>
  );
}
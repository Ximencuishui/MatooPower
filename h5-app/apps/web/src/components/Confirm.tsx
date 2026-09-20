'use client';
// 极简确认对话框:危险操作二次确认(退出登录 / 取消激活等)
import { useState, ReactNode } from 'react';
import { useT } from '@/lib/i18n';

export function Confirm({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive,
}: {
  trigger: (open: () => void) => ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger(() => setOpen(true))}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            aria-label="close"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-5 space-y-4">
            <h3 className="text-base font-bold">{title}</h3>
            {description && (
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{description}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 h-10 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium"
              >
                {cancelLabel ?? t.common.cancel}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  setOpen(false);
                }}
                className={`flex-1 h-10 rounded-xl font-semibold text-white ${
                  destructive ? 'bg-red-500 hover:bg-red-600' : 'bg-matoo hover:bg-matoo-dark'
                }`}
              >
                {confirmLabel ?? t.common.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

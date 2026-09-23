'use client';
// 极简确认对话框:危险操作二次确认(退出登录 / 取消激活等)
// P2-13:加淡入淡出动画 + scale;P2-6:边框 dark:适配
import { useEffect, useState, ReactNode } from 'react';
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      // 触发 CSS transition:下一帧挂载 -> .animate-in
      const id = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(id);
    }
    setMounted(false);
  }, [open]);

  return (
    <>
      {trigger(() => setOpen(true))}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <button
            aria-label="close"
            className={`absolute inset-0 bg-black/40 backdrop-anim ${mounted ? 'backdrop-in' : ''}`}
            onClick={() => setOpen(false)}
          />
          <div className={`relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-5 space-y-4 card-anim ${mounted ? 'card-in' : ''}`}>
            <h3 id="confirm-title" className="text-base font-bold">{title}</h3>
            {description && (
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{description}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 h-10 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium transition focus-visible:ring-2 focus-visible:ring-matoo focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
              >
                {cancelLabel ?? t.common.cancel}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  setOpen(false);
                }}
                className={`flex-1 h-10 rounded-xl font-semibold text-white transition active:scale-95 focus-visible:ring-2 focus-visible:ring-matoo focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
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
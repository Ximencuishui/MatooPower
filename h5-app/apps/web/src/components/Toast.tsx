'use client';
// 极简 Toast 系统:单实例 + 自动消失,P2-12 加淑出动画,P2-6 错误类延时 4.5s
import { useEffect, useState, useCallback, useRef } from 'react';

type ToastItem = {
  id: number;
  kind: 'info' | 'success' | 'error';
  message: string;
  leaving?: boolean;
};

const TOAST_DURATION: Record<ToastItem['kind'], number> = {
  success: 2000,
  info: 2400,
  error: 4500, // P2-6:错误信息 4.5s,让用户看清
};

let pushFn: ((t: Omit<ToastItem, 'id'>) => void) | null = null;

export function toast(message: string, kind: ToastItem['kind'] = 'info') {
  pushFn?.({ message, kind });
}

export function toastSuccess(message: string) {
  toast(message, 'success');
}

export function toastError(message: string) {
  toast(message, 'error');
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = ++counter.current;
    setItems((arr) => [...arr, { ...t, id }]);
    // P2-12:离开前先标 leaving 触发淑出动画,180ms 后再移除
    const duration = TOAST_DURATION[t.kind];
    window.setTimeout(() => {
      setItems((arr) => arr.map((x) => x.id === id ? { ...x, leaving: true } : x));
      window.setTimeout(() => {
        setItems((arr) => arr.filter((x) => x.id !== id));
      }, 180);
    }, duration);
  }, []);

  useEffect(() => {
    pushFn = push;
    return () => {
      pushFn = null;
    };
  }, [push]);

  if (items.length === 0) return null;
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-3 inset-x-0 z-50 pointer-events-none flex flex-col items-center gap-2"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          onClick={() => setItems((arr) => arr.filter((x) => x.id !== t.id))}
          className={`pointer-events-auto px-4 py-2 rounded-xl shadow-lg text-sm font-medium max-w-[80vw] cursor-pointer ${
            t.leaving ? 'animate-toast-out' : 'animate-fade-in-down'
          } ${
            t.kind === 'success'
              ? 'bg-matoo text-white'
              : t.kind === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-slate-800 text-white'
          }`}
        >
          {t.kind === 'success' ? '✓ ' : t.kind === 'error' ? '⚠ ' : ''}
          {t.message}
        </div>
      ))}
    </div>
  );
}
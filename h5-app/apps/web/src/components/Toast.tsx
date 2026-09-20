'use client';
// 极简 Toast 系统:单实例 + 自动消失,3 个简单动作(useReducer 替代 zustand)
// 通过 mount 到 layout 的 <ToastHost/> 渲染;业务调用 toast() 触发
import { useEffect, useState, useCallback, useRef } from 'react';

type ToastItem = {
  id: number;
  kind: 'info' | 'success' | 'error';
  message: string;
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
    window.setTimeout(() => {
      setItems((arr) => arr.filter((x) => x.id !== id));
    }, 2400);
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
      className="fixed top-3 inset-x-0 z-50 pointer-events-none flex flex-col items-center gap-2"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto px-4 py-2 rounded-xl shadow-lg text-sm font-medium max-w-[80vw] animate-fade-in-down ${
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

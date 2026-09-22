'use client';
// useAbortedFetch:封装 useEffect + AbortController,确保组件卸载/dep 变化时取消未完成的 fetch
// 用法:
//   useAbortedFetch(async (signal) => {
//     const r = await api.get('/path', { signal });
//     setX(r);
//   }, [dep]);

import { useEffect } from 'react';

export function useAbortedFetch(
  fn: (signal: AbortSignal) => void | Promise<void>,
  deps: ReadonlyArray<unknown>,
) {
  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    Promise.resolve(fn(ctrl.signal)).catch((e) => {
      // 用户主动取消抛 AbortError,静默忽略;其他错误由 fn 内部处理
      if (e?.name === 'AbortError') return;
      if (!cancelled) console.warn('[useAbortedFetch]', e);
    });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
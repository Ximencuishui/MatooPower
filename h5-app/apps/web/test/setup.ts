// jsdom polyfills + testing-library 扩展
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom 25 未实现 window.PointerEvent;React onPointer* 事件测试需要事件携带
// clientX 等坐标。polyfill 为 MouseEvent 子类(构造 init 透传),语义与浏览器一致。
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = class PointerEvent extends MouseEvent {} as unknown as typeof PointerEvent;
}

// jsdom 未实现 window.matchMedia(ThemeQuickButton / useThemeMode 依赖)。
// polyfill 为 noop + 监听器存根,保证单测不会因 'window.matchMedia is not a function' 崩。
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  window.matchMedia = ((query: string) => {
    const listeners: Array<(e: MediaQueryListEvent) => void> = [];
    const mql = {
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (_t: string, l: (e: MediaQueryListEvent) => void) => listeners.push(l),
      removeEventListener: (_t: string, l: (e: MediaQueryListEvent) => void) => {
        const i = listeners.indexOf(l);
        if (i >= 0) listeners.splice(i, 1);
      },
      addListener: (l: (e: MediaQueryListEvent) => void) => listeners.push(l),
      removeListener: (l: (e: MediaQueryListEvent) => void) => {
        const i = listeners.indexOf(l);
        if (i >= 0) listeners.splice(i, 1);
      },
      dispatchEvent: () => true,
    };
    return mql as unknown as MediaQueryList;
  }) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock fetch（全局默认）
globalThis.fetch = vi.fn() as unknown as typeof fetch;
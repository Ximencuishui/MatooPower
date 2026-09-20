// jsdom polyfills + testing-library 扩展
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock fetch（全局默认）
globalThis.fetch = vi.fn() as unknown as typeof fetch;
// Matoo Power API client
// - 单例 fetch wrapper
// - 自动带 JWT 头
// - 错误归一化：抛 ApiError，{status, code, message}
// - 演示期 base = http://localhost:3001；生产构建时由 NEXT_PUBLIC_API_BASE 覆盖

import { getSession } from './auth-store';

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ApiError';
  }
}

type FetchOpts = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean; // 默认 true；公开端点传 false
  signal?: AbortSignal;
};

async function request<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const s = getSession();
    if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
    credentials: 'omit',
  });

  const text = await res.text();
  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }

  if (!res.ok) {
    const status = res.status;
    const code = (data?.error as string) ?? `HTTP_${status}`;
    const message = (data?.message as string) ?? res.statusText ?? 'Request failed';
    throw new ApiError(status, code, message);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<FetchOpts, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<FetchOpts, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<FetchOpts, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
};

export const API_BASE = BASE;
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

export type FetchOpts = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean; // 默认 true；公开端点传 false
  signal?: AbortSignal;
  /** multipart/form-data 上传（body 传 FormData） */
  isForm?: boolean;
};

async function request<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal, isForm } = opts;
  const headers: Record<string, string> = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (auth) {
    const s = getSession();
    if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? (isForm ? (body as BodyInit) : JSON.stringify(body)) : undefined,
    signal,
    // P0-8 Phase 1：携带 httpOnly cookie（后端登录已 Set-Cookie matoo_token）；
    // 演示期鉴权仍以 Authorization header 为主，cookie 为生产期通道铺路
    credentials: 'include',
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
  // v1.3 P0:补齐 PATCH / DELETE
  patch: <T>(path: string, body?: unknown, opts?: Omit<FetchOpts, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: Omit<FetchOpts, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};

/** 下载 CSV（不走 JSON 解析;返回 Blob） */
export async function downloadCsv(path: string): Promise<Blob> {
  const s = getSession();
  const headers: Record<string, string> = {};
  if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  const res = await fetch(`${BASE}${path}`, { method: 'GET', headers, credentials: 'include' });
  if (!res.ok) {
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { /* */ }
    throw new ApiError(res.status, data?.error ?? `HTTP_${res.status}`, data?.message ?? res.statusText);
  }
  return res.blob();
}

/**
 * v1.5 #P1-1:文件上传(XHR with progress callback)
 * - 严格使用 XMLHttpRequest,带 progress 回调(发票照片、SKU 图片、SKUDocument 都走这里)
 * - 与 fetch 不同:XHR 上传过程中能拿到原生 upload.onprogress,fetch 拿不到
 * - 返回 { url, storageKey, mimeType, sizeBytes }
 */
export function uploadFile(
  path: string,
  file: File | Blob,
  opts: {
    purpose?: string;            // 'invoice' | 'general' | 'avatar'
    fileName?: string;
    signal?: AbortSignal;
    onProgress?: (loaded: number, total: number) => void;
  } = {},
): Promise<{ ok: true; url: string; storageKey: string; mimeType: string; sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}${path}`);
    xhr.responseType = 'json';
    xhr.withCredentials = true;
    if (opts.signal) {
      if (opts.signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      opts.signal.addEventListener('abort', () => xhr.abort());
    }
    const s = getSession();
    if (s?.token) xhr.setRequestHeader('Authorization', `Bearer ${s.token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) opts.onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as any);
      } else {
        const data = xhr.response as any;
        reject(new ApiError(xhr.status, data?.error ?? `HTTP_${xhr.status}`, data?.message ?? xhr.statusText));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK_ERROR', 'upload network error'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    const fd = new FormData();
    fd.append('file', file, opts.fileName ?? (file as File).name ?? 'upload.bin');
    if (opts.purpose) fd.append('purpose', opts.purpose);
    xhr.send(fd);
  });
}

export const API_BASE = BASE;
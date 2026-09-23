// Admin 后台专用的轻量级 API 客户端
// - 直接 fetch（不依赖 web 的 lib/api 复杂 hooks）
// - 自动注入 Authorization header + JWT
// - ApiError 标准化错误，便于前端 catch
// - AbortSignal 透传

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type TokenGetter = () => string | null;
let getToken: TokenGetter = () => null;

/** 注册 token 读取器（auth-store 启动时调用一次） */
export function registerTokenGetter(fn: TokenGetter) {
  getToken = fn;
}

type FetchOpts = { signal?: AbortSignal; skipAuth?: boolean };

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  opts: FetchOpts = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!opts.skipAuth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: opts.signal,
    credentials: 'include',
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // 非 JSON（CSV 等），原样返回
    return text as unknown as T;
  }

  if (!res.ok) {
    const payload = (json ?? {}) as { message?: string; code?: string; details?: unknown };
    throw new ApiError(
      res.status,
      payload.message ?? `${method} ${path} → HTTP ${res.status}`,
      payload.code,
      payload.details,
    );
  }
  return json as T;
}

export const api = {
  get: <T,>(path: string, opts?: FetchOpts) => request<T>('GET', path, undefined, opts),
  post: <T,>(path: string, body?: unknown, opts?: FetchOpts) =>
    request<T>('POST', path, body, opts),
  put: <T,>(path: string, body?: unknown, opts?: FetchOpts) =>
    request<T>('PUT', path, body, opts),
  patch: <T,>(path: string, body?: unknown, opts?: FetchOpts) =>
    request<T>('PATCH', path, body, opts),
  del: <T,>(path: string, opts?: FetchOpts) => request<T>('DELETE', path, undefined, opts),
};

/**
 * multipart/form-data 上传专用工具（用于 SkuDocument 等）
 * - 不强制 Content-Type: application/json，由浏览器自动加 multipart 边界
 * - 不调用 request() 是因为 request() 会把 body 序列化成 JSON
 * - 鉴权与 ApiError 行为与 request() 保持一致
 */
async function uploadForm<T>(
  path: string,
  form: FormData,
  opts: FetchOpts = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (!opts.skipAuth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: form,
    signal: opts.signal,
    credentials: 'include',
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    return text as unknown as T;
  }

  if (!res.ok) {
    const payload = (json ?? {}) as { message?: string; code?: string; details?: unknown };
    throw new ApiError(
      res.status,
      payload.message ?? `POST ${path} → HTTP ${res.status}`,
      payload.code,
      payload.details,
    );
  }
  return json as T;
}

export const API_BASE_URL = API_BASE;

export { uploadForm };
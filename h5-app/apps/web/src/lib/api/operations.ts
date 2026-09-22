// 业务封装：把 fetch 调用和类型绑在一起
import { api, downloadCsv, type FetchOpts } from './client';
import type {
  ActivateWarrantyBody,
  ActivateWarrantyResp,
  AdminOverviewDto,
  AdminUserItem,
  AdminWarrantyItem,
  AuthSessionDto,
  BulkActivateBody,
  BulkActivateResp,
  CreateTicketBody,
  DealerOverviewDto,
  DealerWarrantyItem,
  DeviceDto,
  DeviceHealthDto,
  DiagnosticsResult,
  OtpRequestBody,
  OtpVerifyBody,
  PageResp,
  SkuDto,
  TicketDetail,
  TicketItem,
  TicketStatsDto,
  UpdateTicketBody,
} from './endpoints';

// Auth
export const requestOtp = (body: OtpRequestBody, opts?: FetchOpts) =>
  api.post<{ ok: true; phone: string; sent: boolean; ttl: number }>('/auth/otp/request', body, { ...opts, auth: false });

export const verifyOtp = (body: OtpVerifyBody, opts?: FetchOpts) =>
  api.post<AuthSessionDto>('/auth/otp/verify', body, { ...opts, auth: false });

// P0-1 v1.2:登出 — 后端清 httpOnly cookie + 前端清 localStorage
export const logout = (opts?: FetchOpts) =>
  api.post<{ ok: true }>('/auth/logout', undefined, { ...opts, auth: false });

// SKU
export const getSku = (id: string, opts?: FetchOpts) =>
  api.get<SkuDto>(`/sku/${encodeURIComponent(id)}`, { ...opts, auth: false });

// Warranty
export const activateWarranty = (body: ActivateWarrantyBody, opts?: FetchOpts) =>
  api.post<ActivateWarrantyResp>('/warranty/activate', body, opts);

// P0-1:按 skuId 查保修(用于激活后跳 /warranty/[skuId])
export const getWarrantyBySku = (skuId: string, opts?: FetchOpts) =>
  api.get<{ ok: true; warranty: any | null }>(`/warranty/by-sku/${encodeURIComponent(skuId)}`, opts);

// Device
export const bindDevice = (skuId: string, opts?: FetchOpts) =>
  api.post<{ ok: true; device: DeviceDto }>('/device/bind', { skuId }, opts);

export const listMyDevices = (opts?: FetchOpts) =>
  api.get<{ ok: true; items: DeviceDto[] }>('/device/mine', opts);

export const getDeviceHealth = (id: string, opts?: FetchOpts) =>
  api.get<DeviceHealthDto>(`/device/${encodeURIComponent(id)}/health`, opts);

export const triggerDiagnostics = (id: string, opts?: FetchOpts) =>
  api.post<DiagnosticsResult>(`/device/${encodeURIComponent(id)}/diagnostics`, undefined, opts);

// 错误码 → 跳统一失败页的 kind 映射
export function apiErrorToFailKind(err: unknown): 'fake' | 'revoked' | 'network' {
  if (err instanceof Error && err.name === 'ApiError') {
    const status = (err as any).status;
    if (status === 404) return 'fake';
    if (status === 410 || status === 409) return 'revoked';
  }
  return 'network';
}

// Dealer
export const getDealerOverview = (opts?: FetchOpts) =>
  api.get<DealerOverviewDto>('/dealer/me', opts);

export const listDealerWarranties = (status?: string, opts?: FetchOpts) =>
  api.get<{ ok: true; items: DealerWarrantyItem[] }>(
    status ? `/dealer/warranties?status=${encodeURIComponent(status)}` : '/dealer/warranties',
    opts,
  );

export const bulkActivateDealer = (body: BulkActivateBody, opts?: FetchOpts) =>
  api.post<BulkActivateResp>('/dealer/bulk-activate', body, opts);

// Ticket
export const listMyTickets = (status?: string, opts?: FetchOpts) =>
  api.get<{ ok: true; items: TicketItem[] }>(
    status ? `/tickets/mine?status=${encodeURIComponent(status)}` : '/tickets/mine',
    opts,
  );

export const createTicket = (body: CreateTicketBody, opts?: FetchOpts) =>
  api.post<{ ok: true; ticket: TicketDetail }>('/tickets', body, opts);

export const getTicketDetail = (id: string, opts?: FetchOpts) =>
  api.get<{ ok: true; ticket: TicketDetail }>(`/tickets/${encodeURIComponent(id)}`, opts);

export const replyTicket = (id: string, body: string, opts?: FetchOpts) =>
  api.post<{ ok: true }>(`/tickets/${encodeURIComponent(id)}/reply`, { body }, opts);

// Admin
export const listAllTickets = (params?: { status?: string; severity?: string; q?: string; page?: number; pageSize?: number }, opts?: FetchOpts) => {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.severity) q.set('severity', params.severity);
  if (params?.q) q.set('q', params.q);
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return api.get<{ ok: true; items: TicketItem[]; total: number; page: number; pageSize: number }>(`/admin/tickets${qs ? `?${qs}` : ''}`, opts);
};

export const updateTicket = (id: string, body: UpdateTicketBody, opts?: FetchOpts) =>
  api.put<{ ok: true; ticket: TicketItem }>(`/tickets/${encodeURIComponent(id)}`, body, opts);

export const getAdminOverview = (_unused?: unknown, opts?: FetchOpts) =>
  api.get<AdminOverviewDto>('/admin/overview', opts);

export const getTicketStats = (opts?: FetchOpts) =>
  api.get<TicketStatsDto>('/admin/tickets/stats', opts);

export const getAnalyticsTrends = (days = 30, opts?: FetchOpts) =>
  api.get<{ ok: true; days: number; warranty: Array<{ day: string; c: number }>; device: Array<{ day: string; c: number }>; ticket: Array<{ day: string; c: number }> }>(
    `/admin/analytics/trends?days=${days}`,
    opts,
  );

export const getAnalyticsBreakdown = (type: 'warranty' | 'device' | 'ticket', groupBy: 'sku' | 'country' | 'severity' | 'role', opts?: FetchOpts) =>
  api.get<{ ok: true; items: Array<{ key: string; c: number }> }>(
    `/admin/analytics/breakdown?type=${type}&groupBy=${groupBy}`,
    opts,
  );

// Admin warranties review
export const listAdminWarranties = (params?: { q?: string; status?: string; page?: number; pageSize?: number }, opts?: FetchOpts) => {
  const q = new URLSearchParams();
  if (params?.q) q.set('q', params.q);
  if (params?.status) q.set('status', params.status);
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return api.get<PageResp<AdminWarrantyItem>>(`/admin/warranties${qs ? `?${qs}` : ''}`, opts);
};

export const reviewWarranty = (id: string, body: { status: 'active' | 'pending' | 'expired' | 'rejected'; notes?: string }, opts?: FetchOpts) =>
  api.post<{ ok: true; warranty: AdminWarrantyItem }>(`/admin/warranties/${encodeURIComponent(id)}/review`, body, opts);

// P0-6 v1.2 增量:批量审核(演示期上限 100 条)
export const bulkReviewWarranties = (
  ids: string[],
  body: { status: 'active' | 'pending' | 'expired' | 'rejected'; notes?: string },
  opts?: FetchOpts,
) =>
  api.post<{
    ok: true;
    succeeded: Array<{ id: string; status: string }>;
    failed: Array<{ id: string; reason: string }>;
    total: number;
  }>(`/admin/warranties/bulk-review`, { ids, ...body }, opts);

// P0-4 v1.2 增量:审计查询
export const listAdminAudit = (params?: { resource?: string; limit?: number }, opts?: FetchOpts) => {
  const q = new URLSearchParams();
  if (params?.resource) q.set('resource', params.resource);
  if (params?.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return api.get<{ ok: true; total: number; items: Array<Record<string, unknown>> }>(
    `/admin/audit${qs ? `?${qs}` : ''}`,
    opts,
  );
};

export const getWarrantyAuditTrail = (warrantyId: string, opts?: FetchOpts) =>
  api.get<{
    ok: true;
    audit: Array<Record<string, unknown>>;
    reviewLogs: Array<Record<string, unknown>>;
  }>(`/admin/audit/warranty/${encodeURIComponent(warrantyId)}`, opts);

// Admin users
export const listAdminUsers = (params?: { q?: string; role?: string; page?: number; pageSize?: number }, opts?: FetchOpts) => {
  const q = new URLSearchParams();
  if (params?.q) q.set('q', params.q);
  if (params?.role) q.set('role', params.role);
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return api.get<PageResp<AdminUserItem>>(`/admin/users${qs ? `?${qs}` : ''}`, opts);
};

// Admin SKU list (for inventory mgmt)
export const listAdminSkus = (params?: { q?: string; page?: number; pageSize?: number }, opts?: FetchOpts) => {
  const q = new URLSearchParams();
  if (params?.q) q.set('q', params.q);
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return api.get<PageResp<SkuDto>>(`/admin/sku${qs ? `?${qs}` : ''}`, opts);
};

// ============================================================
// v1.1 CSV exports
// ============================================================
function qs(params?: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const downloadAdminSkuCsv = (q?: string) => downloadCsv(`/admin/sku.csv${qs({ q })}`);
export const downloadAdminWarrantiesCsv = (q?: string, status?: string) =>
  downloadCsv(`/admin/warranties.csv${qs({ q, status })}`);
export const downloadAdminDevicesCsv = (q?: string) => downloadCsv(`/admin/devices.csv${qs({ q })}`);
export const downloadAdminUsersCsv = (q?: string, role?: string) =>
  downloadCsv(`/admin/users.csv${qs({ q, role })}`);
export const downloadAdminTicketsCsv = (q?: string, status?: string, severity?: string) =>
  downloadCsv(`/admin/tickets.csv${qs({ q, status, severity })}`);

export const downloadDealerWarrantiesCsv = (status?: string) =>
  downloadCsv(`/dealer/warranties.csv${qs({ status })}`);
export const downloadDealerDevicesCsv = () => downloadCsv(`/dealer/devices.csv`);

/** 触发浏览器下载(BOM-safe) */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// v1.3 P0:SKU 批次 + 文档 + QR 批量
// ============================================================
export type SkuBatchItem = {
  id: string; batchCode: string; mfgDate: string;
  factory: string | null; destinationCountry: string | null;
  totalQuantity: number; note: string | null;
  createdByUserId: string | null; createdAt: string;
  skuCount: number; documentCount: number; qrBatchCount: number;
};
export type SkuDocumentItem = {
  id: string; skuId: string; batchId: string | null;
  type: 'manual' | 'video' | 'specsheet' | 'faq';
  lang: 'zh' | 'en' | 'bn' | 'hi' | 'ur';
  version: string; title: string; fileName: string;
  mimeType: string; sizeBytes: number; storageKey: string;
  sha256: string; uploadedByUserId: string | null;
  uploadedAt: string; deprecatedAt: string | null;
};
export type QrBatchItem = {
  id: string; batchId: string; totalQuantity: number;
  generatedCount: number; status: 'pending' | 'running' | 'done' | 'failed';
  zipStorageKey: string | null; errorMessage: string | null;
  generatedByUserId: string; startedAt: string | null;
  finishedAt: string | null; createdAt: string;
};

// --- SkuBatch ---
export const listAdminSkuBatches = (params?: { q?: string; page?: number; pageSize?: number }, opts?: FetchOpts) => {
  const q = new URLSearchParams();
  if (params?.q) q.set('q', params.q);
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return api.get<PageResp<SkuBatchItem>>(`/admin/sku-batch${qs ? `?${qs}` : ''}`, opts);
};

export const createAdminSkuBatch = (body: {
  batchCode: string; mfgDate: string; factory?: string;
  destinationCountry?: string; totalQuantity?: number; note?: string;
}, opts?: FetchOpts) =>
  api.post<{ ok: true; batch: SkuBatchItem }>('/admin/sku-batch', body, opts);

export const updateAdminSkuBatch = (id: string, body: Partial<{
  batchCode: string; mfgDate: string; factory: string;
  destinationCountry: string; totalQuantity: number; note: string;
}>, opts?: FetchOpts) =>
  api.patch<{ ok: true; batch: SkuBatchItem }>(`/admin/sku-batch/${encodeURIComponent(id)}`, body, opts);

export const deleteAdminSkuBatch = (id: string, opts?: FetchOpts) =>
  api.delete<{ ok: true; id: string }>(`/admin/sku-batch/${encodeURIComponent(id)}`, opts);

// --- SkuDocument ---
export const listAdminSkuDocuments = (params?: {
  skuId?: string; type?: SkuDocumentItem['type']; lang?: SkuDocumentItem['lang'];
  includeDeprecated?: boolean; page?: number; pageSize?: number;
}, opts?: FetchOpts) => {
  const q = new URLSearchParams();
  if (params?.skuId) q.set('skuId', params.skuId);
  if (params?.type) q.set('type', params.type);
  if (params?.lang) q.set('lang', params.lang);
  if (params?.includeDeprecated) q.set('includeDeprecated', 'true');
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return api.get<PageResp<SkuDocumentItem>>(`/admin/sku-document${qs ? `?${qs}` : ''}`, opts);
};

export const uploadAdminSkuDocument = (formData: FormData, opts?: FetchOpts) =>
  api.post<{ ok: true; document: SkuDocumentItem }>('/admin/sku-document', formData, { ...opts, isForm: true });

export const deleteAdminSkuDocument = (id: string, opts?: FetchOpts) =>
  api.delete<{ ok: true; document: SkuDocumentItem }>(`/admin/sku-document/${encodeURIComponent(id)}`, opts);

export const downloadAdminSkuDocument = (id: string) =>
  downloadCsv(`/admin/sku-document/${encodeURIComponent(id)}/download`);

// --- QrBatch ---
export const triggerAdminQrBatch = (body: { batchId: string; quantity?: number }, opts?: FetchOpts) =>
  api.post<{ ok: true; task: QrBatchItem }>('/admin/qr-batch', body, opts);

export const listAdminQrBatches = (params?: { page?: number; pageSize?: number }, opts?: FetchOpts) => {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return api.get<PageResp<QrBatchItem>>(`/admin/qr-batch${qs ? `?${qs}` : ''}`, opts);
};

export const getAdminQrBatch = (id: string, opts?: FetchOpts) =>
  api.get<{ ok: true; task: QrBatchItem }>(`/admin/qr-batch/${encodeURIComponent(id)}`, opts);

export const downloadAdminQrBatch = (id: string) =>
  downloadCsv(`/admin/qr-batch/${encodeURIComponent(id)}/download`);

export const revokeAdminQr = (qrId: string, opts?: FetchOpts) =>
  api.post<{ ok: true; qrId: string }>(`/admin/qr/${encodeURIComponent(qrId)}/revoke`, undefined, opts);
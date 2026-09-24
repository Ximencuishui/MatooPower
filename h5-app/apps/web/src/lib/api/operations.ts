// 业务封装：把 fetch 调用和类型绑在一起
import { api, downloadCsv, uploadFile, type FetchOpts } from './client';
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

// ============================================================
// v1.4 P1:GDPR 软删 + Dealer 表 + SLA + i18n
// ============================================================

// P1-1:GDPR DELETE /admin/users/:id
export const gdprDeleteAdminUser = (id: string, opts?: FetchOpts) =>
  api.delete<{
    ok: true;
    id: string;
    deletedAt: string;
    anonymizedPhone: string | null;
    anonymizedEmail: string | null;
  }>(`/admin/users/${encodeURIComponent(id)}`, opts);

// P1-2:经销商独立 Dealer 表 CRUD + 专属价格
export type AdminDealerItem = {
  id: string;
  companyName: string;
  country: string;
  tier: 'silver' | 'gold' | 'platinum';
  contactEmail: string | null;
  contactPhone: string | null;
  status: 'active' | 'suspended';
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  priceListCount?: number;
};
export type AdminDealerPriceItem = {
  id: string;
  dealerId: string;
  skuId: string;
  priceCents: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdByUserId: string | null;
  createdAt: string;
  skuSku?: string;
  skuSerial?: string;
};
export type AdminDealerDetail = AdminDealerItem & {
  priceList: AdminDealerPriceItem[];
  members: Array<{ id: string; phone: string | null; email: string | null; displayName: string | null; role: string }>;
};

export const listAdminDealers = (params?: { q?: string; status?: string; page?: number; pageSize?: number }, opts?: FetchOpts) => {
  const q = new URLSearchParams();
  if (params?.q) q.set('q', params.q);
  if (params?.status) q.set('status', params.status);
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return api.get<PageResp<AdminDealerItem>>(`/admin/dealers${qs ? `?${qs}` : ''}`, opts);
};

export const getAdminDealer = (id: string, opts?: FetchOpts) =>
  api.get<{ ok: true; dealer: AdminDealerDetail }>(`/admin/dealers/${encodeURIComponent(id)}`, opts);

export const createAdminDealer = (body: {
  companyName: string; country: string;
  tier?: 'silver' | 'gold' | 'platinum';
  contactEmail?: string; contactPhone?: string; note?: string;
}, opts?: FetchOpts) =>
  api.post<{ ok: true; dealer: AdminDealerItem }>('/admin/dealers', body, opts);

export const updateAdminDealer = (id: string, body: Partial<{
  companyName: string; country: string; tier: 'silver' | 'gold' | 'platinum';
  contactEmail: string; contactPhone: string; note: string;
}>, opts?: FetchOpts) =>
  api.patch<{ ok: true; dealer: AdminDealerItem }>(`/admin/dealers/${encodeURIComponent(id)}`, body, opts);

export const suspendAdminDealer = (id: string, opts?: FetchOpts) =>
  api.delete<{ ok: true; dealer: AdminDealerItem }>(`/admin/dealers/${encodeURIComponent(id)}`, opts);

export const activateAdminDealer = (id: string, opts?: FetchOpts) =>
  api.post<{ ok: true; dealer: AdminDealerItem }>(`/admin/dealers/${encodeURIComponent(id)}/activate`, undefined, opts);

export const addAdminDealerPrice = (dealerId: string, body: {
  skuId: string; priceCents: number; currency?: string;
  effectiveFrom?: string; effectiveTo?: string;
}, opts?: FetchOpts) =>
  api.post<{ ok: true; price: AdminDealerPriceItem }>(
    `/admin/dealers/${encodeURIComponent(dealerId)}/prices`, body, opts);

export const removeAdminDealerPrice = (dealerId: string, priceId: string, opts?: FetchOpts) =>
  api.delete<{ ok: true; id: string }>(
    `/admin/dealers/${encodeURIComponent(dealerId)}/prices/${encodeURIComponent(priceId)}`, opts);

// P1-3:工单 SLA stats
export const getTicketSlaStats = (opts?: FetchOpts) =>
  api.get<{ ok: true; openOver2h: number; highOver4h: number }>('/admin/tickets/sla-stats', opts);

// P1-3:手动触发 SLA sweep(admin only,调试 + 冒烟)
export const runTicketSlaSweep = (opts?: FetchOpts) =>
  api.post<{ ok: true; upgraded: number; details: { id: string; from: string; to: string }[] }>(
    '/admin/tickets/sla-sweep', undefined, opts);

// ============================================================
// v1.5 #P1-1:通用文件上传(XHR with progress)
// ============================================================
export const uploadInvoicePhoto = (
  file: File | Blob,
  opts?: { signal?: AbortSignal; onProgress?: (loaded: number, total: number) => void; fileName?: string },
) => uploadFile('/storage/upload', file, { ...opts, purpose: 'invoice' });

export const uploadGeneralFile = (
  file: File | Blob,
  opts?: { signal?: AbortSignal; onProgress?: (loaded: number, total: number) => void; purpose?: string; fileName?: string },
) => uploadFile('/storage/upload', file, opts);

// ============================================================
// v1.5 #P0-2:配件商城 API
// ============================================================
export type PartItem = {
  id: string; sku: string; name: string; modelName: string;
  family: 'cell' | 'bms' | 'charger' | 'cable' | 'accessory';
  capacity: string | null; voltage: string | null;
  compatibleSkus: string[] | null;
  description: string | null; imageUrls: string[] | null;
  priceCents: number; currency: string;
  stock: number; active: number;
  createdAt: string; updatedAt: string;
};
export type PartOrderItem = {
  id: string; partId: string; sku: string; name: string;
  priceCents: number; currency: string; quantity: number;
};
export type PartOrder = {
  id: string; userId: string; status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';
  totalCents: number; currency: string;
  contactPhone: string | null; shipName: string | null; shipCountry: string | null;
  shipCity: string | null; shipAddress: string | null; note: string | null;
  paidAt: string | null; shippedAt: string | null; completedAt: string | null; cancelledAt: string | null;
  source: string | null;
  createdAt: string; updatedAt: string;
  items?: PartOrderItem[];
};

export const listParts = (params?: { family?: string; q?: string }, opts?: FetchOpts) => {
  const q = new URLSearchParams();
  if (params?.family) q.set('family', params.family);
  if (params?.q) q.set('q', params.q);
  const qs = q.toString();
  return api.get<{ ok: true; items: PartItem[] }>(`/parts${qs ? `?${qs}` : ''}`, { ...opts, auth: false });
};
export const getPart = (id: string, opts?: FetchOpts) =>
  api.get<{ ok: true; part: PartItem }>(`/parts/${encodeURIComponent(id)}`, { ...opts, auth: false });

export const createPartOrder = (body: {
  items: Array<{ partId: string; quantity: number }>;
  contactPhone?: string; shipName?: string; shipCountry?: string;
  shipCity?: string; shipAddress?: string; note?: string; source?: string;
}, opts?: FetchOpts) =>
  api.post<{ ok: true; order: PartOrder; orderId: string; totalCents: number }>('/parts/orders', body, opts);

export const listMyPartOrders = (opts?: FetchOpts) =>
  api.get<{ ok: true; items: PartOrder[] }>('/parts/orders/mine', opts);

// ============================================================
// v1.5 #P0-3:经销商提货 API(dealer 角色)
// ============================================================
export type DealerPickupItemRow = { id: string; sku: string; serial: string; activated: number; warrantyId: string | null; createdAt: string };
export type DealerPickup = {
  id: string; dealerId: string;
  shipmentInvoiceNo: string; shipmentDate: string;
  createdByUserId: string; note: string | null;
  createdAt: string;
  items: DealerPickupItemRow[];
  activatedCount?: number; totalCount?: number;
};

export const listDealerPickups = (params?: { invoiceNo?: string }, opts?: FetchOpts) => {
  const q = new URLSearchParams();
  if (params?.invoiceNo) q.set('invoiceNo', params.invoiceNo);
  const qs = q.toString();
  return api.get<{ ok: true; items: DealerPickup[] }>(`/dealer/pickups${qs ? `?${qs}` : ''}`, opts);
};
export const createDealerPickup = (body: {
  shipmentInvoiceNo: string; shipmentDate: string;
  items: Array<{ sku: string; serial: string }>;
  note?: string;
}, opts?: FetchOpts) =>
  api.post<{ ok: true; pickup: DealerPickup }>('/dealer/pickups', body, opts);
export const deleteDealerPickup = (id: string, opts?: FetchOpts) =>
  api.delete<{ ok: true; id: string }>(`/dealer/pickups/${encodeURIComponent(id)}`, opts);

// ============================================================
// v1.5 #P1-9:经销商专属价表(消费 DealerPriceList)
// ============================================================
export type DealerPriceRow = {
  id: string; skuId: string; priceCents: number; currency: string;
  effectiveFrom: string; effectiveTo: string | null;
  sku: string; modelName: string; serial: string;
  imageUrls: string | null;
  guidePriceCents: number | null; guidePriceCurrency: string | null;
};
export const getDealerPriceList = (opts?: FetchOpts) =>
  api.get<{ ok: true; items: DealerPriceRow[] }>('/dealer/price-list', opts);

// ============================================================
// v1.5 #P1-2:by-serial 解析真实 SKU(H5 扫码后立刻反查)
// ============================================================
export const getSkuBySerial = (serial: string, opts?: FetchOpts) =>
  api.get<{
    ok: true; skuId: string; sku: string; modelName: string; serial: string;
    batch: string; mfgDate: string; activated: boolean; activatedAt: string | null;
  }>(`/admin/sku/by-serial/${encodeURIComponent(serial)}`, { ...opts, auth: false });

// ============================================================
// v1.5 #P1-3:User suspension
// ============================================================
export const suspendAdminUser = (id: string, reason: string, opts?: FetchOpts) =>
  api.post<{ ok: true; user: any }>(`/admin/users/${encodeURIComponent(id)}/suspend`, { reason }, opts);
export const unsuspendAdminUser = (id: string, opts?: FetchOpts) =>
  api.post<{ ok: true; user: any }>(`/admin/users/${encodeURIComponent(id)}/unsuspend`, undefined, opts);
export const getAdminUser = (id: string, opts?: FetchOpts) =>
  api.get<{ ok: true; user: any }>(`/admin/users/${encodeURIComponent(id)}`, opts);
// Admin 后台 API operations（独立于 apps/web 的 lib/api/operations.ts）
// 仅封装 admin 真正用到的端点，路径/参数与后端 controller 1:1 对齐

import { api, uploadForm, uploadFormWithProgress, type UploadProgressHandler } from './client';
import { SKU_IMAGE_LANGS, type SkuImageLang } from '@matoo/shared';
// re-export 以保持向后兼容（其他模块可能直接引用这些符号）
export { SKU_IMAGE_LANGS };
export type { SkuImageLang };

/* ---------- Auth ---------- */
export interface OtpRequestResult {
  ok: true;
  phone: string;
  sent: true;
  ttl: number;
}
export interface AdminSessionUser {
  id: string;
  phone: string;
  role: 'admin' | 'dealer' | 'customer';
  displayName: string | null;
}
export interface OtpVerifyResult {
  ok: true;
  token: string;
  user: AdminSessionUser;
}

export const requestOtp = (phone: string, signal?: AbortSignal) =>
  api.post<OtpRequestResult>('/auth/otp/request', { phone }, { signal });

export const verifyOtp = (
  phone: string,
  code: string,
  signal?: AbortSignal,
) =>
  api.post<OtpVerifyResult>('/auth/otp/verify', { phone, code }, { signal });

export const logout = (signal?: AbortSignal) =>
  api.post<{ ok: true }>('/auth/logout', undefined, { signal });

/* ---------- Admin: Overview ---------- */
export interface AdminOverviewDto {
  ok: true;
  overview: {
    sku: { total: number; activated: number };
    user: { total: number; dealer: number };
    warranty: { active: number; activeThisMonth: number };
    device: { total: number; boundThisMonth: number };
    ticket: { open: number; urgent: number; newThisMonth: number };
  };
}
export const getAdminOverview = (signal?: AbortSignal) =>
  api.get<AdminOverviewDto>('/admin/overview', { signal });

/* ---------- Admin: Trends / Breakdown ----------
 * 契约对齐后端 controller(apps/api/src/modules/admin/admin.controller.ts):
 * - GET /admin/analytics/trends?days=N
 *     → { ok: true; days: number; warranty: AdminTrendPoint[]; device: AdminTrendPoint[]; ticket: AdminTrendPoint[] }
 *     元素字段是 { day, c }(后端 SQL AS c,见 admin.service.trends)
 * - GET /admin/analytics/breakdown?type=...&groupBy=...
 *     → { ok: true; items: Array<{ key: string; c: number }> }
 *     按 type( warranty | device | ticket )+ groupBy( sku | country | severity | role )单维度返回
 */
export interface AdminTrendPoint { day: string; c: number }
export interface AdminTrendsDto {
  ok: true;
  days: number;
  warranty: AdminTrendPoint[];
  device: AdminTrendPoint[];
  ticket: AdminTrendPoint[];
}
export interface AdminBreakdownItem { key: string; c: number }
export interface AdminBreakdownDto {
  ok: true;
  items: AdminBreakdownItem[];
}

export const getAdminTrends = (signal?: AbortSignal) =>
  api.get<AdminTrendsDto>('/admin/analytics/trends', { signal });

export type BreakdownType = 'warranty' | 'device' | 'ticket';
export type BreakdownGroupBy = 'sku' | 'country' | 'severity' | 'role';
export const getAdminBreakdown = (
  type: BreakdownType,
  groupBy: BreakdownGroupBy,
  signal?: AbortSignal,
) =>
  api.get<AdminBreakdownDto>(
    `/admin/analytics/breakdown?type=${type}&groupBy=${groupBy}`,
    { signal },
  );

/* ---------- Admin: Tickets ---------- */
export type TicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_customer'
  | 'resolved'
  | 'closed';
export type TicketSeverity = 'low' | 'normal' | 'high' | 'urgent';
export interface AdminTicketItem {
  id: string;
  userId: string;
  userPhone?: string | null;
  userDisplayName?: string | null;
  subject: string;
  status: TicketStatus;
  severity: TicketSeverity;
  createdAt: string;
  updatedAt: string;
}
export interface AdminTicketsDto {
  ok: true;
  items: AdminTicketItem[];
  total: number;
}
export const listTickets = (
  params: { status?: TicketStatus; q?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const q = qs.toString();
  return api.get<AdminTicketsDto>(`/admin/tickets${q ? `?${q}` : ''}`, { signal });
};

/* ---------- Admin: Users ---------- */
export interface AdminUserItem {
  id: string;
  phone?: string | null;
  email?: string | null;
  displayName?: string | null;
  role: 'admin' | 'dealer' | 'customer';
  createdAt: string;
  warrantyCount: number;
}
export interface AdminUsersDto {
  ok: true;
  items: AdminUserItem[];
  total: number;
}
export const listUsers = (
  params: { role?: 'admin' | 'dealer' | 'customer'; q?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams();
  if (params.role) qs.set('role', params.role);
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const q = qs.toString();
  return api.get<AdminUsersDto>(`/admin/users${q ? `?${q}` : ''}`, { signal });
};

/* ---------- Admin: Warranties ---------- */
export interface AdminWarrantyItem {
  id: string;
  skuId: string;
  userId: string;
  userPhone?: string | null;
  userDisplayName?: string | null;
  status: 'pending' | 'active' | 'review' | 'rejected' | 'expired';
  activatedAt?: string | null;
  reviewStatus?: 'pending' | 'approved' | 'rejected' | null;
  createdAt: string;
}
export interface AdminWarrantiesDto {
  ok: true;
  items: AdminWarrantyItem[];
  total: number;
}
export const listWarranties = (
  params: { status?: string; q?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const q = qs.toString();
  return api.get<AdminWarrantiesDto>(`/admin/warranties${q ? `?${q}` : ''}`, { signal });
};

/* ---------- Admin: Ticket Detail ---------- */
export interface TicketMessage {
  id: string;
  ticketId: string;
  userId: string;
  userRole: 'customer' | 'dealer' | 'admin' | 'support';
  userDisplayName?: string | null;
  body: string;
  createdAt: string;
}
export interface TicketDetail {
  id: string;
  userId: string;
  userPhone?: string | null;
  userDisplayName?: string | null;
  subject: string;
  body: string;
  status: TicketStatus;
  severity: TicketSeverity;
  category?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}
export const getTicketDetail = (id: string, signal?: AbortSignal) =>
  api.get<{ ok: true; ticket: TicketDetail }>(`/tickets/${id}`, { signal });

/* ---------- Admin: User Detail ---------- */
export interface AdminWarrantyLiteItem {
  id: string;
  skuId: string;
  status: 'active' | 'pending' | 'expired' | 'rejected' | 'review';
  country?: string | null;
  createdAt: string;
  reviewNotes?: string | null;
  s_sku?: string;
  s_modelName?: string;
  s_serial?: string;
}
export interface UserDetail {
  id: string;
  phone?: string | null;
  email?: string | null;
  displayName?: string | null;
  role: 'admin' | 'dealer' | 'customer';
  createdAt: string;
  warrantyCount: number;
  warranties: AdminWarrantyLiteItem[];
}
export const getUserDetail = (id: string, signal?: AbortSignal) =>
  api.get<{ ok: true; user: UserDetail }>(`/admin/users/${id}`, { signal });

/* ---------- Admin: Warranty Detail ---------- */
export interface WarrantyDetail extends AdminWarrantyItem {
  s_sku?: string;
  s_modelName?: string;
  s_serial?: string;
  country?: string;
  deviceId?: string | null;
  invoiceNo?: string | null;
  notes?: string | null;
  reviewer?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  auditLogs?: Array<{ at: string; by: string; action: string; notes?: string }>;
}
export const getWarrantyDetail = (id: string, signal?: AbortSignal) =>
  api.get<{ ok: true; warranty: WarrantyDetail }>(`/admin/warranties/${id}`, { signal });

/* ---------- Admin: Write operations ---------- */
export type WarrantyReviewStatus =
  | 'active'
  | 'pending'
  | 'expired'
  | 'rejected'
  | 'review';
export const reviewWarranty = (
  id: string,
  status: WarrantyReviewStatus,
  notes?: string,
  signal?: AbortSignal,
) =>
  api.post<{ ok: true; warranty: WarrantyDetail }>(
    `/admin/warranties/${id}/review`,
    { status, notes },
    { signal },
  );

export const bulkReviewWarranties = (
  ids: string[],
  status: WarrantyReviewStatus,
  notes?: string,
  signal?: AbortSignal,
) =>
  api.post<{ ok: true; succeeded: number; failed: number; errors?: unknown[] }>(
    '/admin/warranties/bulk-review',
    { ids, status, notes },
    { signal },
  );

export const replyTicket = (id: string, body: string, signal?: AbortSignal) =>
  api.post<{ ok: true; message: TicketMessage }>(`/tickets/${id}/reply`, { body }, { signal });

export const updateTicket = (
  id: string,
  body: { status?: TicketStatus; severity?: TicketSeverity },
  signal?: AbortSignal,
) =>
  api.put<{ ok: true; ticket: TicketDetail }>(`/tickets/${id}`, body, { signal });

export const updateUserRole = (
  id: string,
  role: 'admin' | 'dealer' | 'customer',
  signal?: AbortSignal,
) =>
  api.patch<{ ok: true; user: UserDetail }>(`/admin/users/${id}/role`, { role }, { signal });

/* ---------- Admin: SKUs (商品列表) ---------- */
export interface AdminSkuItem {
  id: string;
  sku: string;
  serial: string;
  batch: string;
  batchId: string | null;
  mfgDate: string;
  modelName: string;
  family: 'battery' | 'controller' | 'panel';
  capacity: string;
  voltage: string;
  chemistry: string;
  cycles: string;
  warrantyMonthsWhole: number;
  warrantyMonthsCell?: number | null;
  warrantyMonthsBms?: number | null;
  warrantyMonthsParts?: number | null;
  activated: number | boolean;
  activatedAt?: string | null;
  activatedByUserId?: string | null;
  createdAt: string;
  // v1.4 P2-3:商品库扩展字段(后端 SELECT * FROM Sku 自动返回)
  description?: string | null;
  imageUrls?: string | null;
  videoTrailerUrl?: string | null;
  guidePriceCents?: number | null;
  guidePriceCurrency?: string | null;
  guidePriceNote?: string | null;
  catalogUpdatedAt?: string | null;
  catalogUpdatedBy?: string | null;
}
export interface AdminSkusDto {
  ok: true;
  items: AdminSkuItem[];
  total: number;
}
export const listAdminSkus = (
  params: { q?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const q = qs.toString();
  return api.get<AdminSkusDto>(`/admin/sku${q ? `?${q}` : ''}`, { signal });
};

/* ---------- Admin: SKU Catalog (商品库描述/图片/指导价) ---------- */
export interface SkuCatalogView {
  id: string;
  sku: string;
  serial: string;
  modelName: string;
  family: string;
  description: string | null;
  imageUrls: string[];
  videoTrailerUrl: string | null;
  guidePriceCents: number | null;
  guidePriceCurrency: string | null;
  guidePriceNote: string | null;
  catalogUpdatedAt: string | null;
  catalogUpdatedBy: string | null;
}
export const getSkuCatalog = (id: string, signal?: AbortSignal) =>
  api.get<{ ok: true; catalog: SkuCatalogView }>(`/admin/sku-catalog/${id}`, { signal });

export interface UpdateSkuCatalogBody {
  description?: string;
  imageUrls?: string;
  videoTrailerUrl?: string;
  guidePriceCents?: number;
  guidePriceCurrency?: string;
  guidePriceNote?: string;
}
export const updateSkuCatalog = (id: string, body: UpdateSkuCatalogBody, signal?: AbortSignal) =>
  api.patch<{ ok: true; catalog: SkuCatalogView }>(`/admin/sku-catalog/${id}`, body, { signal });

/* ---------- Admin: SKU Images (详情图片集) ---------- */
// 语言常量 + 类型已从 @matoo/shared 导入并 re-export（见文件顶部）
export interface SkuImageRow {
  id: string;
  skuId: string;
  lang: string;
  storageKey: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
  sortOrder: number;
  isCover: number;
  sha256: string;
  uploadedByUserId: string | null;
  uploadedAt: string;
  deprecatedAt: string | null;
}
export const listSkuImages = (
  params: { skuId: string; lang?: SkuImageLang; includeDeprecated?: boolean },
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams();
  qs.set('skuId', params.skuId);
  if (params.lang) qs.set('lang', params.lang);
  if (params.includeDeprecated) qs.set('includeDeprecated', 'true');
  return api.get<{ ok: true; items: SkuImageRow[] }>(`/admin/sku-image?${qs.toString()}`, { signal });
};
export const uploadSkuImage = (form: FormData, signal?: AbortSignal) =>
  uploadForm<{ ok: true; image: SkuImageRow }>('/admin/sku-image', form, { signal });
export interface SkuBulkUploadFailure {
  fileName: string;
  error: string;
}
export type SkuBulkUploadResultItem =
  | { fileName: string; ok: true; image: SkuImageRow }
  | { fileName: string; ok: false; error: string };
export interface SkuBulkUploadResult {
  ok: true;
  /**
   * 与输入文件按顺序、与输入等长、按 fileName 一一对应。
   * 前端必须按 fileName 查找，禁止按数组下标读取 —— 下标在部分失败时会错位。
   */
  results: SkuBulkUploadResultItem[];
  items: SkuImageRow[];
  failures: SkuBulkUploadFailure[];
}
/**
 * 批量上传 SKU 图片（≤5 张/次，XHR 上传 + 进度回调）
 * - onProgress(loaded, total)：合并所有上传项的总字节进度
 * - 返回 results(与输入等长按 fileName 对齐) + items + failures；服务端 207 状态码
 */
export const bulkUploadSkuImages = (
  form: FormData,
  onProgress: UploadProgressHandler,
  signal?: AbortSignal,
) =>
  uploadFormWithProgress<SkuBulkUploadResult>(
    '/admin/sku-image/bulk',
    form,
    onProgress,
    { signal },
  );
export const updateSkuImage = (
  id: string,
  body: { alt?: string; caption?: string; sortOrder?: number; isCover?: boolean },
  signal?: AbortSignal,
) =>
  api.patch<{ ok: true; image: SkuImageRow }>(`/admin/sku-image/${id}`, body, { signal });
export const deprecateSkuImage = (id: string, signal?: AbortSignal) =>
  api.del<{ ok: true; image: SkuImageRow }>(`/admin/sku-image/${id}`, { signal });

/* ---------- Admin: Devices (设备列表) ---------- */
export interface AdminDeviceItem {
  id: string;
  skuId: string;
  userId: string;
  boundAt: string;
  lastSeenAt: string;
  soh: number | null;
  soc: number | null;
  cycles: number | null;
  temp: number | null;
  volt: number | null;
  curr: number | null;
  fw: string | null;
  alarms: number | null;
  s_sku?: string;
  s_modelName?: string;
  s_serial?: string;
  user_phone?: string | null;
  user_displayName?: string | null;
}
export interface AdminDevicesDto {
  ok: true;
  items: AdminDeviceItem[];
  total: number;
}
export const listAdminDevices = (
  params: { q?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const q = qs.toString();
  return api.get<AdminDevicesDto>(`/admin/devices${q ? `?${q}` : ''}`, { signal });
};

/* ---------- Admin: Dealers (经销商 CRUD v1.4 P1-2) ---------- */
export type DealerTier = 'silver' | 'gold' | 'platinum';
export type DealerStatus = 'active' | 'suspended';
export interface DealerItem {
  id: string;
  companyName: string;
  country: string;
  tier: DealerTier;
  contactEmail: string | null;
  contactPhone: string | null;
  status: DealerStatus;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}
export interface DealersPageDto {
  ok: true;
  items: DealerItem[];
  total: number;
  page: number;
  pageSize: number;
}
export interface DealerPriceListItem {
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
}
export interface DealerDetailDto {
  ok: true;
  dealer: DealerItem & {
    priceList: DealerPriceListItem[];
    members: Array<{ id: string; phone: string | null; displayName: string | null; role: string }>;
  };
}
export const listDealers = (
  params: { q?: string; status?: DealerStatus; page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.status) qs.set('status', params.status);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const q = qs.toString();
  return api.get<DealersPageDto>(`/admin/dealers${q ? `?${q}` : ''}`, { signal });
};
export const getDealer = (id: string, signal?: AbortSignal) =>
  api.get<DealerDetailDto>(`/admin/dealers/${id}`, { signal });
export const createDealer = (
  body: {
    companyName: string;
    country: string;
    tier?: DealerTier;
    contactEmail?: string;
    contactPhone?: string;
    note?: string;
  },
  signal?: AbortSignal,
) => api.post<{ ok: true; dealer: DealerItem }>('/admin/dealers', body, { signal });
export const updateDealer = (
  id: string,
  body: Partial<{
    companyName: string;
    country: string;
    tier: DealerTier;
    contactEmail: string;
    contactPhone: string;
    note: string;
  }>,
  signal?: AbortSignal,
) => api.patch<{ ok: true; dealer: DealerItem }>(`/admin/dealers/${id}`, body, { signal });
export const suspendDealer = (id: string, signal?: AbortSignal) =>
  api.del<{ ok: true; dealer: DealerItem }>(`/admin/dealers/${id}`, { signal });
export const activateDealer = (id: string, signal?: AbortSignal) =>
  api.post<{ ok: true; dealer: DealerItem }>(`/admin/dealers/${id}/activate`, undefined, { signal });
export const addDealerPrice = (
  id: string,
  body: {
    skuId: string;
    priceCents: number;
    currency?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
  },
  signal?: AbortSignal,
) =>
  api.post<{ ok: true; price: DealerPriceListItem }>(`/admin/dealers/${id}/prices`, body, { signal });
export const removeDealerPrice = (dealerId: string, priceId: string, signal?: AbortSignal) =>
  api.del<{ ok: true }>(`/admin/dealers/${dealerId}/prices/${priceId}`, { signal });

/* ---------- Admin: SKU Batches (v1.3 P0 批次管理) ---------- */
export interface SkuBatchRow {
  id: string;
  batchCode: string;
  mfgDate: string;
  factory: string | null;
  destinationCountry: string | null;
  totalQuantity: number;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
}
export interface SkuBatchWithStats extends SkuBatchRow {
  skuCount: number;
  documentCount: number;
  qrBatchCount: number;
}
export interface SkuBatchesPageDto {
  ok: true;
  items: SkuBatchWithStats[];
  total: number;
  page: number;
  pageSize: number;
}
export const listSkuBatches = (
  params: { q?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const q = qs.toString();
  return api.get<SkuBatchesPageDto>(`/admin/sku-batch${q ? `?${q}` : ''}`, { signal });
};
export const getSkuBatch = (id: string, signal?: AbortSignal) =>
  api.get<{ ok: true; batch: SkuBatchWithStats }>(`/admin/sku-batch/${id}`, { signal });
export const createSkuBatch = (
  body: {
    batchCode: string;
    mfgDate: string;
    factory?: string;
    destinationCountry?: string;
    totalQuantity: number;
    note?: string;
  },
  signal?: AbortSignal,
) =>
  api.post<{ ok: true; batch: SkuBatchRow }>('/admin/sku-batch', body, { signal });
export const updateSkuBatch = (
  id: string,
  body: Partial<{
    batchCode: string;
    mfgDate: string;
    factory: string;
    destinationCountry: string;
    totalQuantity: number;
    note: string;
  }>,
  signal?: AbortSignal,
) =>
  api.patch<{ ok: true; batch: SkuBatchRow }>(`/admin/sku-batch/${id}`, body, { signal });
export const deleteSkuBatch = (id: string, signal?: AbortSignal) =>
  api.del<{ ok: true; id: string }>(`/admin/sku-batch/${id}`, { signal });

/* ---------- Admin: SKU Documents (v1.3 P0 多语言文档) ---------- */
export type DocType = 'manual' | 'video' | 'specsheet' | 'faq';
export type DocLang = 'zh' | 'en' | 'bn' | 'hi' | 'ur';
export const DOC_TYPES: readonly DocType[] = ['manual', 'video', 'specsheet', 'faq'] as const;
export const DOC_LANGS: readonly DocLang[] = ['zh', 'en', 'bn', 'hi', 'ur'] as const;
export interface SkuDocumentRow {
  id: string;
  skuId: string;
  batchId: string | null;
  type: string;
  lang: string;
  version: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  sha256: string;
  uploadedByUserId: string | null;
  uploadedAt: string;
  deprecatedAt: string | null;
}
export interface SkuDocumentsPageDto {
  ok: true;
  items: SkuDocumentRow[];
  total: number;
  page: number;
  pageSize: number;
}
export const listSkuDocuments = (
  params: {
    skuId?: string;
    type?: DocType;
    lang?: DocLang;
    includeDeprecated?: boolean;
    q?: string;
    page?: number;
    pageSize?: number;
  } = {},
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams();
  if (params.skuId) qs.set('skuId', params.skuId);
  if (params.type) qs.set('type', params.type);
  if (params.lang) qs.set('lang', params.lang);
  if (params.includeDeprecated) qs.set('includeDeprecated', 'true');
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const q = qs.toString();
  return api.get<SkuDocumentsPageDto>(`/admin/sku-document${q ? `?${q}` : ''}`, { signal });
};
export const uploadSkuDocument = (
  form: FormData,
  signal?: AbortSignal,
) => uploadForm<{ ok: true; document: SkuDocumentRow }>('/admin/sku-document', form, { signal });
export const deprecateSkuDocument = (id: string, signal?: AbortSignal) =>
  api.del<{ ok: true; document: SkuDocumentRow }>(`/admin/sku-document/${id}`, { signal });
export const getSkuDocumentDownloadUrl = (id: string) =>
  `${api_getBase()}/admin/sku-document/${id}/download`;

/* ---------- Admin: QR Batches (v1.3 P0 批量生成) ---------- */
export interface QrBatchRow {
  id: string;
  batchId: string;
  totalQuantity: number;
  generatedCount: number;
  status: 'pending' | 'running' | 'done' | 'failed';
  zipStorageKey: string | null;
  createdAt: string;
  finishedAt: string | null;
}
export interface QrBatchPageDto {
  ok: true;
  items: QrBatchRow[];
  total: number;
  page: number;
  pageSize: number;
}
export const listQrBatches = (
  params: { page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const q = qs.toString();
  return api.get<QrBatchPageDto>(`/admin/qr-batch${q ? `?${q}` : ''}`, { signal });
};
export const getQrBatch = (id: string, signal?: AbortSignal) =>
  api.get<{ ok: true; task: QrBatchRow }>(`/admin/qr-batch/${id}`, { signal });
export const triggerQrBatch = (
  body: { batchId: string; quantity?: number },
  signal?: AbortSignal,
) => api.post<{ ok: true; task: QrBatchRow }>('/admin/qr-batch', body, { signal });
export interface RevokedQrItem {
  qrId: string;
  skuId: string;
  signature: string;
  createdAt: string;
}
export interface RevokedQrsPageDto {
  ok: true;
  items: RevokedQrItem[];
  total: number;
  page: number;
  pageSize: number;
}
export const listRevokedQrs = (
  params: { page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const q = qs.toString();
  return api.get<RevokedQrsPageDto>(`/admin/qr/revoked${q ? `?${q}` : ''}`, { signal });
};
export const revokeQr = (qrId: string, signal?: AbortSignal) =>
  api.post<{ ok: true; qrId: string }>(`/admin/qr/${qrId}/revoke`, undefined, { signal });
export const getQrBatchDownloadUrl = (id: string) =>
  `${api_getBase()}/admin/qr-batch/${id}/download`;

/* ---------- Admin: Audit Log (v1.2 P0-4) ---------- */
export interface AuditLogItem {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  resource: string | null;
  payload: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}
export interface AuditListDto {
  ok: true;
  total: number;
  items: AuditLogItem[];
}
export interface WarrantyReviewLogItem {
  id: string;
  warrantyId: string;
  actorUserId: string;
  fromStatus: string;
  toStatus: string;
  notes: string | null;
  createdAt: string;
}
export interface WarrantyAuditTrailDto {
  ok: true;
  audit: AuditLogItem[];
  reviewLogs: WarrantyReviewLogItem[];
}
export const listAudit = (
  params: { resource?: string; limit?: number } = {},
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams();
  if (params.resource) qs.set('resource', params.resource);
  if (params.limit) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return api.get<AuditListDto>(`/admin/audit${q ? `?${q}` : ''}`, { signal });
};
export const getWarrantyAuditTrail = (warrantyId: string, signal?: AbortSignal) =>
  api.get<WarrantyAuditTrailDto>(`/admin/audit/warranty/${warrantyId}`, { signal });

/* ---------- Admin: Tickets SLA (v1.4 P1-3) ---------- */
export interface TicketStatsDto {
  ok: true;
  stats: {
    open: number;
    resolved: number;
    urgent: number;
    todayNew: number;
  };
}
export interface SlaStatsDto {
  ok: true;
  openOver2h: number;
  highOver4h: number;
}
export interface SlaSweepDto {
  ok: true;
  upgraded: number;
}
export const getTicketStats = (signal?: AbortSignal) =>
  api.get<TicketStatsDto>('/admin/tickets/stats', { signal });
export const getSlaStats = (signal?: AbortSignal) =>
  api.get<SlaStatsDto>('/admin/tickets/sla-stats', { signal });
export const runSlaSweep = (signal?: AbortSignal) =>
  api.post<SlaSweepDto>('/admin/tickets/sla-sweep', undefined, { signal });

/* ---------- helper: 拉取 API base URL(用于构造下载直链) ---------- */
import { API_BASE_URL } from './client';
function api_getBase(): string {
  return API_BASE_URL;
}
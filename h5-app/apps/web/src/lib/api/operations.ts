// 业务封装：把 fetch 调用和类型绑在一起
import { api } from './client';
import type {
  ActivateWarrantyBody,
  ActivateWarrantyResp,
  AdminOverviewDto,
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
  SkuDto,
  TicketDetail,
  TicketItem,
  UpdateTicketBody,
} from './endpoints';

// Auth
export const requestOtp = (body: OtpRequestBody) =>
  api.post<{ ok: true; phone: string; sent: boolean; ttl: number }>('/auth/otp/request', body, { auth: false });

export const verifyOtp = (body: OtpVerifyBody) =>
  api.post<AuthSessionDto>('/auth/otp/verify', body, { auth: false });

// SKU
export const getSku = (id: string) =>
  api.get<SkuDto>(`/sku/${encodeURIComponent(id)}`, { auth: false });

// Warranty
export const activateWarranty = (body: ActivateWarrantyBody) =>
  api.post<ActivateWarrantyResp>('/warranty/activate', body);

// Device
export const bindDevice = (skuId: string) =>
  api.post<{ ok: true; device: DeviceDto }>('/device/bind', { skuId });

export const listMyDevices = () =>
  api.get<{ ok: true; items: DeviceDto[] }>('/device/mine');

export const getDeviceHealth = (id: string) =>
  api.get<DeviceHealthDto>(`/device/${encodeURIComponent(id)}/health`);

export const triggerDiagnostics = (id: string) =>
  api.post<DiagnosticsResult>(`/device/${encodeURIComponent(id)}/diagnostics`);

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
export const getDealerOverview = () =>
  api.get<DealerOverviewDto>('/dealer/me');

export const listDealerWarranties = (status?: string) =>
  api.get<{ ok: true; items: DealerWarrantyItem[] }>(
    status ? `/dealer/warranties?status=${encodeURIComponent(status)}` : '/dealer/warranties',
  );

export const bulkActivateDealer = (body: BulkActivateBody) =>
  api.post<BulkActivateResp>('/dealer/bulk-activate', body);

// Ticket
export const listMyTickets = (status?: string) =>
  api.get<{ ok: true; items: TicketItem[] }>(
    status ? `/tickets/mine?status=${encodeURIComponent(status)}` : '/tickets/mine',
  );

export const createTicket = (body: CreateTicketBody) =>
  api.post<{ ok: true; ticket: TicketDetail }>('/tickets', body);

export const getTicketDetail = (id: string) =>
  api.get<{ ok: true; ticket: TicketDetail }>(`/tickets/${encodeURIComponent(id)}`);

export const replyTicket = (id: string, body: string) =>
  api.post<{ ok: true }>(`/tickets/${encodeURIComponent(id)}/reply`, { body });

// Admin
export const listAllTickets = (params?: { status?: string; severity?: string; q?: string; page?: number; pageSize?: number }) => {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.severity) q.set('severity', params.severity);
  if (params?.q) q.set('q', params.q);
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return api.get<{ ok: true; items: TicketItem[]; total: number; page: number; pageSize: number }>(`/admin/tickets${qs ? `?${qs}` : ''}`);
};

export const updateTicket = (id: string, body: UpdateTicketBody) =>
  api.put<{ ok: true; ticket: TicketItem }>(`/tickets/${encodeURIComponent(id)}`, body);

export const getAdminOverview = () =>
  api.get<AdminOverviewDto>('/admin/overview');
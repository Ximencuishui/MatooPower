// 类型化端点（与 apps/api 模块对齐；演示期手写，生产期由 OpenAPI 生成）

export type OtpRequestBody = { phone: string };
export type OtpVerifyBody = { phone: string; code: string };

export type AuthUser = {
  id: string;
  phone?: string;
  email?: string;
  role: 'customer' | 'dealer' | 'admin';
  displayName?: string;
};

export type AuthSessionDto = {
  ok: true;
  token: string;
  user: AuthUser;
};

export type SkuDto = {
  id: string;
  sku: string;
  serial: string;
  batch: string;
  mfgDate: string;
  modelName: string;
  family: string;
  capacity: string;
  voltage: string;
  chemistry: string;
  cycles: string;
  warranty: {
    whole: number;
    cell?: number;
    bms?: number;
    parts?: number;
  };
  activated: boolean;
  activatedAt?: string;
  qr: {
    qrId: string;
    signature: string;
    revoked: boolean;
    scanCount: number;
    lastScanAt?: string;
  };
};

export type ActivateWarrantyBody = {
  skuId: string;
  serial: string;
  batch: string;
  qrSignature: string;
  country: string;
  city: string;
  dealer: string;
  invoiceNo?: string;
  invoiceDate?: string;
  invoiceAmt?: number;
  invoiceCurrency?: string;
  policyAccepted: true;
};

export type ActivateWarrantyResp = {
  ok: true;
  id: string;
  policy: 'INVOICE' | 'MFG_FALLBACK';
  startAt: string;
  endAtWhole: string;
  endAtCell?: string;
  endAtBms?: string;
  endAtParts?: string;
  status: 'active' | 'pending' | 'expired' | 'rejected';
};

export type DeviceDto = {
  id: string;
  skuId: string;
  userId: string;
  boundAt: string;
  lastSeenAt: string;
  soh?: number;
  soc?: number;
  cycles?: number;
  temp?: number;
  volt?: number;
  curr?: number;
  fw?: string;
  alarms?: number;
  s_sku?: string;
  s_modelName?: string;
  s_serial?: string;
};

export type DeviceHealthDto = {
  ok: true;
  id: string;
  skuId: string;
  soh: number;
  soc: number;
  cycles: number;
  temp: number;
  volt: number;
  curr: number;
  fw: string;
  alarms: number;
  boundAt: string;
  lastSeenAt: string;
  online: boolean;
  trend: {
    socLast6h: number[];
    voltLast1h: number[];
  };
};

export type DiagnosticsFinding = {
  code: string;
  severity: 'info' | 'warn' | 'critical';
  message: string;
};

export type DiagnosticsResult = {
  ok: true;
  deviceId: string;
  skuId: string;
  startedAt: string;
  durationMs: number;
  summary: 'ok' | 'warn' | 'critical';
  findings: DiagnosticsFinding[];
  recommendation: string;
};

// Dealer
export type DealerOverviewDto = {
  ok: true;
  user: { id: string; role: string };
  overview: {
    warrantyCount: number;
    deviceCount: number;
    pendingReviewCount: number;
    activatedThisMonth: number;
  };
};

export type BulkActivateItem = {
  qrId: string;
  customerPhone: string;
  customerName?: string;
  invoiceNo?: string;
  invoiceDate?: string;
};

export type BulkActivateBody = {
  shipmentInvoiceNo?: string;
  items: BulkActivateItem[];
};

export type BulkActivateResultItem = {
  qrId: string;
  skuId: string;
  warrantyId: string;
  deviceId: string;
  customerId: string;
  policy: 'INVOICE' | 'MFG_FALLBACK';
};

export type BulkActivateResp = {
  ok: true;
  count: number;
  items: BulkActivateResultItem[];
};

export type DealerWarrantyItem = {
  id: string;
  skuId: string;
  userId: string;
  country: string;
  city: string;
  dealerName: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  invoiceAmount: number | null;
  status: 'active' | 'pending' | 'expired' | 'rejected';
  startAt: string;
  endAtWhole: string;
  endAtCell: string | null;
  endAtBms: string | null;
  endAtParts: string | null;
  reviewNotes: string | null;
  createdAt: string;
  s_sku?: string;
  s_modelName?: string;
  s_serial?: string;
};

// Ticket
export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type TicketSeverity = 'low' | 'normal' | 'high' | 'urgent';
export type TicketType = 'general' | 'warranty' | 'inquiry' | 'remote';

export type TicketItem = {
  id: string;
  userId: string;
  skuId: string | null;
  deviceId: string | null;
  type: TicketType;
  severity: TicketSeverity;
  subject: string;
  description: string;
  contactPhone: string | null;
  status: TicketStatus;
  assigneeUserId: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sku?: string;
  modelName?: string;
  serial?: string;
  authorName?: string;
  assigneeName?: string;
  messageCount: number;
  lastMessageAt?: string;
};

export type TicketMessage = {
  id: string;
  ticketId: string;
  senderUserId: string | null;
  senderRole: 'customer' | 'support' | 'system';
  body: string;
  createdAt: string;
  senderName?: string;
};

export type TicketDetail = TicketItem & {
  sku: string | null;
  modelName: string | null;
  serial: string | null;
  author: { displayName: string; phone: string } | null;
  assignee: { displayName: string } | null;
  messages: TicketMessage[];
};

export type CreateTicketBody = {
  type: TicketType;
  severity: TicketSeverity;
  subject: string;
  description: string;
  skuId?: string;
  deviceId?: string;
  contactPhone?: string;
};

export type UpdateTicketBody = {
  status: TicketStatus;
  resolution?: string;
  assigneeUserId?: string;
};

export type AdminOverviewDto = {
  ok: true;
  overview: {
    sku: { total: number; activated: number };
    user: { total: number; dealer: number };
    warranty: { active: number; activeThisMonth: number };
    device: { total: number; boundThisMonth: number };
    ticket: { open: number; urgent: number; newThisMonth: number };
  };
};
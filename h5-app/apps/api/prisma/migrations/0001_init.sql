-- P0-7 基线迁移：初始 schema 全量（由 init-sqlite.cjs 历史 DDL 收敛而来）
-- 保留 IF NOT EXISTS 幂等语义 = 对已存在的旧库（含 dev.db）应用时平滑跳过
-- 后续变更一律新增 0002_xxx.sql 等顺序迁移，禁止回改本条

CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  passwordHash TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  displayName TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS User_role_idx ON User(role);

CREATE TABLE IF NOT EXISTS OtpRequest (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expiresAt DATETIME NOT NULL,
  consumedAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS OtpRequest_phone_idx ON OtpRequest(phone);
CREATE INDEX IF NOT EXISTS OtpRequest_phone_consumedAt_idx ON OtpRequest(phone, consumedAt);

CREATE TABLE IF NOT EXISTS OtpAttempt (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,             -- P0-9 账户级锁定：验证尝试（含失败/成功）
  ok INTEGER NOT NULL,             -- 0=失败 1=成功
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS OtpAttempt_phone_createdAt_idx ON OtpAttempt(phone, createdAt);

CREATE TABLE IF NOT EXISTS Session (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expiresAt DATETIME NOT NULL,
  userAgent TEXT,
  ip TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS Session_userId_idx ON Session(userId);
CREATE INDEX IF NOT EXISTS Session_expiresAt_idx ON Session(expiresAt);

CREATE TABLE IF NOT EXISTS Sku (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  serial TEXT UNIQUE NOT NULL,
  batch TEXT NOT NULL,
  mfgDate DATETIME NOT NULL,
  modelName TEXT NOT NULL,
  family TEXT NOT NULL,
  capacity TEXT NOT NULL,
  voltage TEXT NOT NULL,
  chemistry TEXT NOT NULL,
  cycles TEXT NOT NULL,
  warrantyMonthsWhole INTEGER NOT NULL,
  warrantyMonthsCell INTEGER,
  warrantyMonthsBms INTEGER,
  warrantyMonthsParts INTEGER,
  activated INTEGER NOT NULL DEFAULT 0,
  activatedAt DATETIME,
  activatedByUserId TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (activatedByUserId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS Sku_sku_idx ON Sku(sku);
CREATE INDEX IF NOT EXISTS Sku_batch_idx ON Sku(batch);

CREATE TABLE IF NOT EXISTS QrSignature (
  id TEXT PRIMARY KEY,
  qrId TEXT UNIQUE NOT NULL,
  skuId TEXT NOT NULL,
  signature TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  scanCount INTEGER NOT NULL DEFAULT 0,
  lastScanAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (skuId) REFERENCES Sku(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS QrSignature_skuId_idx ON QrSignature(skuId);

CREATE TABLE IF NOT EXISTS Warranty (
  id TEXT PRIMARY KEY,
  skuId TEXT NOT NULL,
  userId TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  dealerName TEXT,
  invoiceNo TEXT,
  invoiceDate DATETIME,
  invoiceAmount REAL,
  invoicePhotoUrl TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  startAt DATETIME NOT NULL,
  endAtWhole DATETIME NOT NULL,
  endAtCell DATETIME,
  endAtBms DATETIME,
  endAtParts DATETIME,
  reviewNotes TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (skuId) REFERENCES Sku(id),
  FOREIGN KEY (userId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS Warranty_skuId_idx ON Warranty(skuId);
CREATE INDEX IF NOT EXISTS Warranty_userId_idx ON Warranty(userId);
CREATE INDEX IF NOT EXISTS Warranty_status_idx ON Warranty(status);

CREATE TABLE IF NOT EXISTS Device (
  id TEXT PRIMARY KEY,
  skuId TEXT NOT NULL,
  userId TEXT NOT NULL,
  boundAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastSeenAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  soh INTEGER,
  soc INTEGER,
  cycles INTEGER,
  temp REAL,
  volt REAL,
  curr REAL,
  fw TEXT,
  alarms INTEGER,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (skuId) REFERENCES Sku(id),
  FOREIGN KEY (userId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS Device_skuId_idx ON Device(skuId);
CREATE INDEX IF NOT EXISTS Device_userId_idx ON Device(userId);

CREATE TABLE IF NOT EXISTS Ticket (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  skuId TEXT,
  deviceId TEXT,
  type TEXT NOT NULL DEFAULT 'general',      -- 'general' | 'warranty' | 'inquiry' | 'remote'
  severity TEXT NOT NULL DEFAULT 'normal',   -- 'low' | 'normal' | 'high' | 'urgent'
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  contactPhone TEXT,
  status TEXT NOT NULL DEFAULT 'open',        -- 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
  assigneeUserId TEXT,
  resolution TEXT,
  resolvedAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES User(id),
  FOREIGN KEY (skuId) REFERENCES Sku(id),
  FOREIGN KEY (deviceId) REFERENCES Device(id),
  FOREIGN KEY (assigneeUserId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS Ticket_userId_idx ON Ticket(userId);
CREATE INDEX IF NOT EXISTS Ticket_skuId_idx ON Ticket(skuId);
CREATE INDEX IF NOT EXISTS Ticket_status_idx ON Ticket(status);
CREATE INDEX IF NOT EXISTS Ticket_assigneeUserId_idx ON Ticket(assigneeUserId);

CREATE TABLE IF NOT EXISTS TicketMessage (
  id TEXT PRIMARY KEY,
  ticketId TEXT NOT NULL,
  senderUserId TEXT,
  senderRole TEXT NOT NULL,          -- 'customer' | 'support' | 'system'
  body TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticketId) REFERENCES Ticket(id) ON DELETE CASCADE,
  FOREIGN KEY (senderUserId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS TicketMessage_ticketId_idx ON TicketMessage(ticketId);
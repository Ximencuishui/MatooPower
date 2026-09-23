-- v1.1 audit: WarrantyReviewLog + TicketStatusLog + AuditLog 三表
-- 0001 已应用则增量添加；幂等（IF NOT EXISTS）

CREATE TABLE IF NOT EXISTS WarrantyReviewLog (
  id TEXT PRIMARY KEY,
  warrantyId TEXT NOT NULL,
  actorUserId TEXT NOT NULL,
  fromStatus TEXT NOT NULL,
  toStatus TEXT NOT NULL,
  notes TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warrantyId) REFERENCES Warranty(id),
  FOREIGN KEY (actorUserId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS WarrantyReviewLog_warrantyId_idx ON WarrantyReviewLog(warrantyId);
CREATE INDEX IF NOT EXISTS WarrantyReviewLog_actorUserId_idx ON WarrantyReviewLog(actorUserId);
CREATE INDEX IF NOT EXISTS WarrantyReviewLog_createdAt_idx ON WarrantyReviewLog(createdAt);

CREATE TABLE IF NOT EXISTS TicketStatusLog (
  id TEXT PRIMARY KEY,
  ticketId TEXT NOT NULL,
  actorUserId TEXT NOT NULL,
  fromStatus TEXT NOT NULL,
  toStatus TEXT NOT NULL,
  resolution TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticketId) REFERENCES Ticket(id) ON DELETE CASCADE,
  FOREIGN KEY (actorUserId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS TicketStatusLog_ticketId_idx ON TicketStatusLog(ticketId);
CREATE INDEX IF NOT EXISTS TicketStatusLog_actorUserId_idx ON TicketStatusLog(actorUserId);
CREATE INDEX IF NOT EXISTS TicketStatusLog_createdAt_idx ON TicketStatusLog(createdAt);

-- AuditLog:通用审计表(后续 middleware 写)
CREATE TABLE IF NOT EXISTS AuditLog (
  id TEXT PRIMARY KEY,
  actorUserId TEXT,
  actorRole TEXT,
  action TEXT NOT NULL,            -- 'warranty.review' | 'ticket.update' | 'ticket.reply' | ...
  resource TEXT,                   -- 'warranty:abc' | 'ticket:def'
  payload TEXT,                    -- JSON.stringify(detail)
  ip TEXT,
  userAgent TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actorUserId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS AuditLog_actorUserId_idx ON AuditLog(actorUserId);
CREATE INDEX IF NOT EXISTS AuditLog_action_idx ON AuditLog(action);
CREATE INDEX IF NOT EXISTS AuditLog_createdAt_idx ON AuditLog(createdAt);
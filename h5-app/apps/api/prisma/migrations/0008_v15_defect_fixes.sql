-- v1.5 缺陷修复补丁:批量补齐审计中识别的 8 项缺陷所需 schema
-- 按需应用,每个块独立 IF NOT EXISTS / IF NOT EXISTS 列检查,幂等可重复执行
--
-- #P1-3:User.isActive 字段(Suspension 状态)
-- #P0-2:Part / PartOrder / PartOrderItem(配件商城核心数据)
-- #P0-3:DealerPickup / DealerPickupItem(经销商提货批次)
-- #P1-5:Warranty.dealerId(经销商↔质保强关联)
-- #P1-8:Sku.activatedByDealerId(经销商双轨合并)
-- #P2-3:Ticket.source 字段(工单来源标记)

-- ============================================================
-- 1. #P1-3:User.isActive(账户 Suspension 字段)
-- ============================================================
ALTER TABLE User ADD COLUMN isActive INTEGER NOT NULL DEFAULT 1;
ALTER TABLE User ADD COLUMN suspendedAt DATETIME;
ALTER TABLE User ADD COLUMN suspendedReason TEXT;
CREATE INDEX IF NOT EXISTS User_isActive_idx ON User(isActive);

-- ============================================================
-- 2. #P0-2:配件商城数据模型
-- ============================================================
CREATE TABLE IF NOT EXISTS Part (
  id              TEXT PRIMARY KEY,
  sku             TEXT NOT NULL,                   -- 商品编码 例 'PART-12V-CELL-A'
  name            TEXT NOT NULL,
  modelName       TEXT NOT NULL,                   -- 同 Sku.modelName 风格
  family          TEXT NOT NULL,                   -- 'cell' | 'bms' | 'charger' | 'cable' | 'accessory'
  capacity        TEXT,
  voltage         TEXT,
  compatibleSkus  TEXT,                            -- JSON 字符串数组(适用 SKU 列表)
  description     TEXT,
  imageUrls       TEXT,                            -- JSON 字符串数组
  priceCents      INTEGER NOT NULL,                -- 单位:分
  currency        TEXT NOT NULL DEFAULT 'BDT',
  stock           INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1,      -- 软下架
  createdByUserId TEXT,
  createdAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (createdByUserId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS Part_sku_idx ON Part(sku);
CREATE INDEX IF NOT EXISTS Part_family_idx ON Part(family);
CREATE INDEX IF NOT EXISTS Part_active_idx ON Part(active);

CREATE TABLE IF NOT EXISTS PartOrder (
  id              TEXT PRIMARY KEY,
  userId          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled'
  totalCents      INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'BDT',
  contactPhone    TEXT,
  shipName        TEXT,
  shipCountry     TEXT,
  shipCity        TEXT,
  shipAddress     TEXT,
  note            TEXT,
  paidAt          DATETIME,
  shippedAt       DATETIME,
  completedAt     DATETIME,
  cancelledAt     DATETIME,
  source          TEXT,                            -- 'h5' | 'dealer' (订单来源)
  createdAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS PartOrder_userId_idx ON PartOrder(userId);
CREATE INDEX IF NOT EXISTS PartOrder_status_idx ON PartOrder(status);
CREATE INDEX IF NOT EXISTS PartOrder_createdAt_idx ON PartOrder(createdAt);

CREATE TABLE IF NOT EXISTS PartOrderItem (
  id              TEXT PRIMARY KEY,
  orderId         TEXT NOT NULL,
  partId          TEXT NOT NULL,
  sku             TEXT NOT NULL,                   -- 冗余快照,Part 被改名/删除后仍可追溯
  name            TEXT NOT NULL,
  priceCents      INTEGER NOT NULL,
  currency        TEXT NOT NULL,
  quantity        INTEGER NOT NULL,
  createdAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (orderId) REFERENCES PartOrder(id) ON DELETE CASCADE,
  FOREIGN KEY (partId) REFERENCES Part(id)
);
CREATE INDEX IF NOT EXISTS PartOrderItem_orderId_idx ON PartOrderItem(orderId);
CREATE INDEX IF NOT EXISTS PartOrderItem_partId_idx ON PartOrderItem(partId);

-- ============================================================
-- 3. #P0-3:经销商提货批次
-- ============================================================
CREATE TABLE IF NOT EXISTS DealerPickup (
  id                  TEXT PRIMARY KEY,
  dealerId            TEXT NOT NULL,
  shipmentInvoiceNo   TEXT NOT NULL,
  shipmentDate        DATETIME NOT NULL,
  createdByUserId     TEXT NOT NULL,
  createdAt           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note                TEXT,
  FOREIGN KEY (dealerId) REFERENCES Dealer(id) ON DELETE CASCADE,
  FOREIGN KEY (createdByUserId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS DealerPickup_dealerId_idx ON DealerPickup(dealerId);
CREATE INDEX IF NOT EXISTS DealerPickup_invoiceNo_idx ON DealerPickup(shipmentInvoiceNo);

CREATE TABLE IF NOT EXISTS DealerPickupItem (
  id              TEXT PRIMARY KEY,
  pickupId        TEXT NOT NULL,
  sku             TEXT NOT NULL,
  serial          TEXT NOT NULL,
  activated       INTEGER NOT NULL DEFAULT 0,
  warrantyId      TEXT,                            -- 激活后回填
  createdAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pickupId) REFERENCES DealerPickup(id) ON DELETE CASCADE,
  FOREIGN KEY (warrantyId) REFERENCES Warranty(id)
);
CREATE INDEX IF NOT EXISTS DealerPickupItem_pickupId_idx ON DealerPickupItem(pickupId);
CREATE INDEX IF NOT EXISTS DealerPickupItem_serial_idx ON DealerPickupItem(serial);
CREATE INDEX IF NOT EXISTS DealerPickupItem_activated_idx ON DealerPickupItem(activated);

-- ============================================================
-- 4. #P1-5 + #P1-8:经销商双轨合并
-- ============================================================
ALTER TABLE Sku ADD COLUMN activatedByDealerId TEXT;
CREATE INDEX IF NOT EXISTS Sku_activatedByDealerId_idx ON Sku(activatedByDealerId);

ALTER TABLE Warranty ADD COLUMN dealerId TEXT;
CREATE INDEX IF NOT EXISTS Warranty_dealerId_idx ON Warranty(dealerId);

-- ============================================================
-- 5. #P2-3:Ticket.source 字段
-- ============================================================
ALTER TABLE Ticket ADD COLUMN source TEXT;             -- 'web' | 'h5' | 'dealer' | 'system'
CREATE INDEX IF NOT EXISTS Ticket_source_idx ON Ticket(source);

-- ============================================================
-- 6. schema_migrations 兼容:本文件已是 0008,prisma migrate.js 通过文件名排序
-- ============================================================

-- v1.4 P1:GDPR 软删 + 经销商独立 Dealer 表 + 专属价格
-- 幂等(IF NOT EXISTS / ADD COLUMN 可重复),后续按顺序追加
-- 0001/0002/0003 已应用则增量添加

-- ============================================================
-- P1-1:GDPR 软删
-- User 表加 deletedAt / anonymizedPhone / anonymizedEmail
-- phone/email 删时置 NULL(SQLite NULL 不参与 UNIQUE,索引天然允许)
-- ============================================================
ALTER TABLE User ADD COLUMN deletedAt DATETIME;
ALTER TABLE User ADD COLUMN anonymizedPhone TEXT;
ALTER TABLE User ADD COLUMN anonymizedEmail TEXT;
CREATE INDEX IF NOT EXISTS User_deletedAt_idx ON User(deletedAt);

-- ============================================================
-- P1-2:经销商独立 Dealer 表 + DealerPriceList 专属价
-- User 加 dealerId 外键(向下兼容,旧 dealer user 留 null)
-- ============================================================
CREATE TABLE IF NOT EXISTS Dealer (
  id TEXT PRIMARY KEY,
  companyName TEXT NOT NULL,
  country TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'silver',   -- 'silver' | 'gold' | 'platinum'
  contactEmail TEXT,
  contactPhone TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended'
  note TEXT,
  createdByUserId TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (createdByUserId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS Dealer_status_idx ON Dealer(status);
CREATE INDEX IF NOT EXISTS Dealer_country_idx ON Dealer(country);

-- DealerPriceList:某 dealer 对某 SKU 的专属价(分 currency,支持生效区间)
CREATE TABLE IF NOT EXISTS DealerPriceList (
  id TEXT PRIMARY KEY,
  dealerId TEXT NOT NULL,
  skuId TEXT NOT NULL,
  priceCents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT',
  effectiveFrom DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effectiveTo DATETIME,
  createdByUserId TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dealerId) REFERENCES Dealer(id),
  FOREIGN KEY (skuId) REFERENCES Sku(id),
  FOREIGN KEY (createdByUserId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS DealerPriceList_dealerId_idx ON DealerPriceList(dealerId);
CREATE INDEX IF NOT EXISTS DealerPriceList_skuId_idx ON DealerPriceList(skuId);
CREATE INDEX IF NOT EXISTS DealerPriceList_effective_idx ON DealerPriceList(effectiveFrom, effectiveTo);

-- User 加 dealerId 外键(SQLite ALTER TABLE 不能加 FK 约束,仅加列;应用层维护完整性)
ALTER TABLE User ADD COLUMN dealerId TEXT;
CREATE INDEX IF NOT EXISTS User_dealerId_idx ON User(dealerId);
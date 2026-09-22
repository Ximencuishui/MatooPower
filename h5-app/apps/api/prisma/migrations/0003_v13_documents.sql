-- v1.3 P0:SKU 批次 + 文档 + QR 批量 三张表 + Sku.batchId 列
-- 幂等(IF NOT EXISTS),可重复应用

-- 1. SkuBatch 表（生产批次维度）
CREATE TABLE IF NOT EXISTS SkuBatch (
  id TEXT PRIMARY KEY,
  batchCode TEXT NOT NULL UNIQUE,
  mfgDate DATETIME NOT NULL,
  factory TEXT,
  destinationCountry TEXT,
  totalQuantity INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  createdByUserId TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (createdByUserId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS SkuBatch_mfgDate_idx ON SkuBatch(mfgDate);

-- 2. SkuDocument 表（多语言 + 多版本）
CREATE TABLE IF NOT EXISTS SkuDocument (
  id TEXT PRIMARY KEY,
  skuId TEXT NOT NULL,
  batchId TEXT,
  type TEXT NOT NULL,
  lang TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  fileName TEXT NOT NULL,
  mimeType TEXT NOT NULL,
  sizeBytes INTEGER NOT NULL,
  storageKey TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  uploadedByUserId TEXT,
  uploadedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deprecatedAt DATETIME,
  FOREIGN KEY (skuId) REFERENCES Sku(id) ON DELETE CASCADE,
  FOREIGN KEY (batchId) REFERENCES SkuBatch(id),
  FOREIGN KEY (uploadedByUserId) REFERENCES User(id),
  UNIQUE (skuId, type, lang, version)
);
CREATE INDEX IF NOT EXISTS SkuDocument_skuId_type_lang_idx ON SkuDocument(skuId, type, lang);
CREATE INDEX IF NOT EXISTS SkuDocument_batchId_idx ON SkuDocument(batchId);
CREATE INDEX IF NOT EXISTS SkuDocument_sha256_idx ON SkuDocument(sha256);
CREATE INDEX IF NOT EXISTS SkuDocument_deprecatedAt_idx ON SkuDocument(deprecatedAt);

-- 3. QrBatch 表（QR 批量生成任务）
CREATE TABLE IF NOT EXISTS QrBatch (
  id TEXT PRIMARY KEY,
  batchId TEXT NOT NULL,
  totalQuantity INTEGER NOT NULL,
  generatedCount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  zipStorageKey TEXT,
  errorMessage TEXT,
  generatedByUserId TEXT NOT NULL,
  startedAt DATETIME,
  finishedAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batchId) REFERENCES SkuBatch(id),
  FOREIGN KEY (generatedByUserId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS QrBatch_batchId_idx ON QrBatch(batchId);
CREATE INDEX IF NOT EXISTS QrBatch_status_idx ON QrBatch(status);
CREATE INDEX IF NOT EXISTS QrBatch_createdAt_idx ON QrBatch(createdAt);

-- 4. Sku 表加 batchId 列（依赖 migrate.js 的 schema_migrations 整体幂等保护）
-- SQLite 不支持给已存在表加 FOREIGN KEY 约束,仅添加列（应用层维护关联完整性）
ALTER TABLE Sku ADD COLUMN batchId TEXT;
CREATE INDEX IF NOT EXISTS Sku_batchId_idx ON Sku(batchId);
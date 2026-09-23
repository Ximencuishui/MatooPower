-- v1.4 P2-3:商品库扩展字段(description / 详情图片 / 主视频 / 全局指导价)
-- + 新表 SkuImage(SKU 详情图片集,带 order 排序)
-- 幂等(IF NOT EXISTS),可重复应用

-- 1. Sku 表加商品资料 / 图片 / 视频 / 指导价 字段
ALTER TABLE Sku ADD COLUMN description TEXT;
ALTER TABLE Sku ADD COLUMN imageUrls TEXT;            -- JSON 字符串数组(主图集快照,冗余用于快速读)
ALTER TABLE Sku ADD COLUMN videoTrailerUrl TEXT;      -- 主视频预告 URL(与 SkuDocument video 互补)
ALTER TABLE Sku ADD COLUMN guidePriceCents INTEGER;    -- 全局指导价(最小单位:分)
ALTER TABLE Sku ADD COLUMN guidePriceCurrency TEXT;    -- ISO 4217 三字母,默认 BDT
ALTER TABLE Sku ADD COLUMN guidePriceNote TEXT;        -- 价格备注(例 "限时活动 -5%" / "含税")
ALTER TABLE Sku ADD COLUMN catalogUpdatedAt DATETIME;  -- 最后一次后台编辑时间(便于审计 + cache 失效)
ALTER TABLE Sku ADD COLUMN catalogUpdatedBy TEXT;      -- 最后编辑人 userId(便于审计)

CREATE INDEX IF NOT EXISTS Sku_catalogUpdatedAt_idx ON Sku(catalogUpdatedAt);

-- 2. SkuImage 表(SKU 详情图片集,支持多语言 + 排序 + 软删除)
CREATE TABLE IF NOT EXISTS SkuImage (
  id                TEXT PRIMARY KEY,
  skuId             TEXT NOT NULL,
  lang              TEXT NOT NULL DEFAULT 'en',   -- 'zh' | 'en' | 'bn' | 'hi' | 'ur'(与 SkuDocument 对齐)
  storageKey        TEXT NOT NULL,                -- StorageService 生成的 key
  url               TEXT NOT NULL,                -- 公开 URL(/storage/<key>)
  mimeType          TEXT NOT NULL,                -- 'image/jpeg' | 'image/png' | 'image/webp'
  sizeBytes         INTEGER NOT NULL,
  width             INTEGER,                      -- 可选:用于前端响应式 <picture>
  height            INTEGER,
  alt               TEXT,                         -- alt 文本(无障碍)
  caption           TEXT,                         -- 图片说明(图注)
  sortOrder         INTEGER NOT NULL DEFAULT 0,   -- 拖拽排序(越小越靠前)
  isCover           INTEGER NOT NULL DEFAULT 0,   -- 是否主图(0/1;每个 SKU+lang 至多 1 张)
  sha256            TEXT NOT NULL,                -- 内容哈希,防重复上传 + 篡改检测
  uploadedByUserId  TEXT,
  uploadedAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deprecatedAt      DATETIME,                     -- 软删除
  FOREIGN KEY (skuId) REFERENCES Sku(id) ON DELETE CASCADE,
  FOREIGN KEY (uploadedByUserId) REFERENCES User(id)
);

CREATE INDEX IF NOT EXISTS SkuImage_skuId_lang_idx ON SkuImage(skuId, lang);
CREATE INDEX IF NOT EXISTS SkuImage_skuId_sortOrder_idx ON SkuImage(skuId, sortOrder);
CREATE INDEX IF NOT EXISTS SkuImage_sha256_idx ON SkuImage(sha256);
CREATE INDEX IF NOT EXISTS SkuImage_deprecatedAt_idx ON SkuImage(deprecatedAt);
CREATE INDEX IF NOT EXISTS SkuImage_isCover_idx ON SkuImage(skuId, isCover);
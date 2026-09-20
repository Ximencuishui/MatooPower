// 直接用 node:sqlite (Node 22+ 内置) 初始化 SQLite schema（绕过 prisma engine 子进程）
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

// 优先用 argv[2]（测试场景指定 db），其次用 ENV DATABASE_URL，最后默认 prisma/dev.db
const dbFile = process.argv[2]
  || (process.env.DATABASE_URL && process.env.DATABASE_URL.replace(/^file:/, ''))
  || path.join(process.cwd(), 'prisma', 'dev.db');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

// sqlite driver：node:sqlite 用 better-sqlite3 兼容 API
const Database = require('node:sqlite').DatabaseSync;
let nativeBinding = (() => {
  try { return require('node:sqlite'); } catch (e) { return null; }
})();

// node:sqlite 直接用
const db = new DatabaseSync(dbFile);
db.exec('PRAGMA journal_mode = WAL');

const ddl = [
  `CREATE TABLE IF NOT EXISTS User (
     id TEXT PRIMARY KEY,
     phone TEXT UNIQUE,
     email TEXT UNIQUE,
     passwordHash TEXT,
     role TEXT NOT NULL DEFAULT 'customer',
     displayName TEXT,
     createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS User_role_idx ON User(role)`,
  `CREATE TABLE IF NOT EXISTS OtpRequest (
     id TEXT PRIMARY KEY,
     phone TEXT NOT NULL,
     code TEXT NOT NULL,
     expiresAt DATETIME NOT NULL,
     consumedAt DATETIME,
     createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS OtpRequest_phone_idx ON OtpRequest(phone)`,
  `CREATE INDEX IF NOT EXISTS OtpRequest_phone_consumedAt_idx ON OtpRequest(phone, consumedAt)`,
  `CREATE TABLE IF NOT EXISTS Session (
     id TEXT PRIMARY KEY,
     userId TEXT NOT NULL,
     token TEXT UNIQUE NOT NULL,
     expiresAt DATETIME NOT NULL,
     userAgent TEXT,
     ip TEXT,
     createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS Session_userId_idx ON Session(userId)`,
  `CREATE INDEX IF NOT EXISTS Session_expiresAt_idx ON Session(expiresAt)`,
  `CREATE TABLE IF NOT EXISTS Sku (
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
   )`,
  `CREATE INDEX IF NOT EXISTS Sku_sku_idx ON Sku(sku)`,
  `CREATE INDEX IF NOT EXISTS Sku_batch_idx ON Sku(batch)`,
  `CREATE TABLE IF NOT EXISTS QrSignature (
     id TEXT PRIMARY KEY,
     qrId TEXT UNIQUE NOT NULL,
     skuId TEXT NOT NULL,
     signature TEXT NOT NULL,
     revoked INTEGER NOT NULL DEFAULT 0,
     scanCount INTEGER NOT NULL DEFAULT 0,
     lastScanAt DATETIME,
     createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (skuId) REFERENCES Sku(id) ON DELETE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS QrSignature_skuId_idx ON QrSignature(skuId)`,
  `CREATE TABLE IF NOT EXISTS Warranty (
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
   )`,
  `CREATE INDEX IF NOT EXISTS Warranty_skuId_idx ON Warranty(skuId)`,
  `CREATE INDEX IF NOT EXISTS Warranty_userId_idx ON Warranty(userId)`,
  `CREATE INDEX IF NOT EXISTS Warranty_status_idx ON Warranty(status)`,
  `CREATE TABLE IF NOT EXISTS Device (
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
   )`,
  `CREATE INDEX IF NOT EXISTS Device_skuId_idx ON Device(skuId)`,
  `CREATE INDEX IF NOT EXISTS Device_userId_idx ON Device(userId)`,
  `CREATE TABLE IF NOT EXISTS Ticket (
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
   )`,
  `CREATE INDEX IF NOT EXISTS Ticket_userId_idx ON Ticket(userId)`,
  `CREATE INDEX IF NOT EXISTS Ticket_skuId_idx ON Ticket(skuId)`,
  `CREATE INDEX IF NOT EXISTS Ticket_status_idx ON Ticket(status)`,
  `CREATE INDEX IF NOT EXISTS Ticket_assigneeUserId_idx ON Ticket(assigneeUserId)`,
  `CREATE TABLE IF NOT EXISTS TicketMessage (
     id TEXT PRIMARY KEY,
     ticketId TEXT NOT NULL,
     senderUserId TEXT,
     senderRole TEXT NOT NULL,          -- 'customer' | 'support' | 'system'
     body TEXT NOT NULL,
     createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (ticketId) REFERENCES Ticket(id) ON DELETE CASCADE,
     FOREIGN KEY (senderUserId) REFERENCES User(id)
   )`,
  `CREATE INDEX IF NOT EXISTS TicketMessage_ticketId_idx ON TicketMessage(ticketId)`,
];

let ok = 0, fail = 0;
for (const s of ddl) {
  try { db.exec(s); ok++; }
  catch (e) { console.error('FAIL', s.slice(0,80), e.message); fail++; }
}
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('ddl ok=', ok, 'fail=', fail);
console.log('tables:', tables.map(t => t.name).join(','));
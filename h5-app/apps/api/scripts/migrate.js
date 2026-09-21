// P0-7 零依赖 SQLite 迁移器（node:sqlite 内置，无 prisma/drizzle 引擎）
// 用法：
//   node scripts/migrate.js [dbPath]        # 应用未执行迁移（默认 prisma/dev.db，保留 DATABASE_URL 覆盖）
// 约定：
//   - 迁移文件：prisma/migrations/NNNN_name.sql，按文件名升序执行
//   - 版本记录：schema_migrations 表（version 主键），同一版本只应用一次
//   - 失败语义：单文件整体事务，失败 ROLLBACK 且不记版本 → 修复后重跑即可
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbFile = process.argv[2]
  || (process.env.DATABASE_URL && process.env.DATABASE_URL.replace(/^file:/, ''))
  || path.join(process.cwd(), 'prisma', 'dev.db');
const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');

if (!fs.existsSync(migrationsDir)) {
  console.error(`migrate: migrations dir not found: ${migrationsDir}`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new DatabaseSync(dbFile);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  appliedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const appliedSet = new Set(
  db.prepare('SELECT version FROM schema_migrations').all().map((r) => String(r.version)),
);

let applied = 0;
let skipped = 0;
for (const file of files) {
  const version = file.replace(/\.sql$/, '');
  if (appliedSet.has(version)) {
    skipped++;
    console.log(`migrate: skip ${file} (already applied)`);
    continue;
  }
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  db.exec('BEGIN');
  try {
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(version, file);
    db.exec('COMMIT');
    applied++;
    console.log(`migrate: apply ${file}`);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(`migrate: FAIL ${file}: ${err.message}`);
    console.error(`migrate: DB at ${dbFile} unchanged (version ${version} not recorded, rerun after fix)`);
    process.exit(1);
  }
}

console.log(`migrate: done applied=${applied} skipped=${skipped} on ${dbFile}`);
db.close();
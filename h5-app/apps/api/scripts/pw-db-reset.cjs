// T4 Playwright：api webServer 启动前置——重置测试库（删旧建新 + 迁移 + 播种）
// 用法：node scripts/pw-db-reset.cjs <db-file>，随后启动 api（node dist/src/main.js）
// 背景：globalSetup 与 webServer 存在启动竞态（api 先打开旧库 → globalSetup 删库被 Windows 锁
// 静默失败 → 旧数据跨 run 残留）。改为 api 自身 spawn 前置 reset：此刻无进程持有该库，
// 删除必然成功，彻底消除时序依赖。
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dbFile = process.argv[2];
if (!dbFile) {
  console.error('usage: node scripts/pw-db-reset.cjs <db-file>');
  process.exit(1);
}

// 删旧库（含 SQLite WAL 姊妹文件）；force + 显式复核防止 Windows 锁导致的静默残留
for (const ext of ['', '-journal', '-wal', '-shm']) {
  try { fs.rmSync(dbFile + ext, { force: true }); } catch { /* rmSync force 不抛 */ }
}
if (fs.existsSync(dbFile)) {
  console.error(`pw-db-reset: cannot delete ${dbFile} (locked by another process?)`);
  process.exit(1);
}

const apiRoot = path.resolve(__dirname, '..');
execFileSync(process.execPath, [path.join(apiRoot, 'prisma', 'init-sqlite.cjs'), dbFile], {
  stdio: 'pipe',
  env: { ...process.env, DATABASE_URL: `file:${dbFile}` },
});
execFileSync(process.execPath, [path.join(apiRoot, 'prisma', 'run-seed.cjs')], {
  stdio: 'pipe',
  env: { ...process.env, DEV_DB: dbFile, QR_HMAC_SECRET: 'pw-test-hmac-secret' },
});
console.log(`pw-db-reset: ${dbFile} ready (migrated + seeded)`);
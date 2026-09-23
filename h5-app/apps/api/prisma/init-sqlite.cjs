// P0-7：init-sqlite.cjs 已收敛为迁移器薄包装（历史文件名与 argv 约定保留，
// e2e helpers / `db:init` 均引用本文件，行为不变）。
// 历史职责（手工 DDL 数组，无法版本控制）已迁移至 prisma/migrations/*.sql（顺序 + 事务 + schema_migrations 记录）。
// 数据库初始化 = 应用全部未执行迁移；无参数时默认 prisma/dev.db（migrate.js 内自带 DATABASE_URL 覆盖）。
const path = require('path');
const { execFileSync } = require('child_process');

const migrator = path.join(__dirname, '..', 'scripts', 'migrate.js');
const args = [migrator];
if (process.argv[2]) args.push(process.argv[2]);

execFileSync(process.execPath, args, { stdio: 'inherit' });
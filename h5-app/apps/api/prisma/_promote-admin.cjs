// _promote-admin.cjs — 临时演示期 helper,把指定手机号的用户提升为 admin 角色
// 仅在演示期 SQLite 数据库上使用 — 生产期不要部署此文件
// 用法:node _promote-admin.cjs <dbPath> <phone>

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = process.argv[2];
const phone = process.argv[3];

if (!dbPath || !phone) {
  console.error('usage: node _promote-admin.cjs <dbPath> <phone>');
  process.exit(2);
}

const db = new DatabaseSync(path.resolve(dbPath));
const tx = db.exec.bind(db);
const r = db.prepare.bind(db);

const before = r('SELECT role FROM User WHERE phone = ?').get(phone);
if (!before) {
  console.error('USER_NOT_FOUND phone=' + phone);
  process.exit(3);
}
tx('UPDATE User SET role = ? WHERE phone = ?');
r('UPDATE User SET role = ? WHERE phone = ?').run('admin', phone);
const after = r('SELECT id, phone, role FROM User WHERE phone = ?').get(phone);
console.log('PROMOTE_RESULT changes=1 id=' + after.id + ' role=' + after.role);

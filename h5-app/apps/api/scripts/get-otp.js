// 开发期 OTP 读取工具：node scripts/get-otp.js [+88010000002]
// P0-10 修复：去掉写死绝对路径，改用 cwd 相对路径（与 seed.ts/run-seed.cjs 对齐），
// 需要时可用 DEV_DB 环境变量覆盖（例：DEV_DB=./tmp.db）
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.env.DEV_DB ?? path.join(process.cwd(), 'prisma', 'dev.db'));
const phone = process.argv[2] || '+88010000002';
const row = db.prepare('SELECT code, expiresAt FROM OtpRequest WHERE phone = ? AND consumedAt IS NULL ORDER BY createdAt DESC LIMIT 1').get(phone);
console.log('OTP:', row);
db.close();
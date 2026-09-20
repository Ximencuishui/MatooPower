const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('E:/MatooPower/h5-app/apps/api/prisma/dev.db');
const phone = process.argv[2] || '+88010000002';
const row = db.prepare('SELECT code, expiresAt FROM OtpRequest WHERE phone = ? AND consumedAt IS NULL ORDER BY createdAt DESC LIMIT 1').get(phone);
console.log('OTP:', row);
db.close();
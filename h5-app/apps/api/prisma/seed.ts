// Matoo Power API · 种子数据（demo period）
// 用法：npx ts-node prisma/seed.ts   或   npm run db:seed
// 幂等：每次运行会 upsert 演示用户、SKU、QR、保修、设备。

import { randomBytes } from 'crypto';
import { createHmac } from 'crypto';
import * as path from 'path';
// @ts-ignore — node:sqlite is built into Node 22+, but TS types lag in @types/node@20
import sqlite from 'node:sqlite';

const { DatabaseSync } = sqlite as any;

const DB_FILE = path.resolve(process.cwd(), 'prisma', 'dev.db');
const QR_HMAC_SECRET = process.env.QR_HMAC_SECRET || 'dev-only-secret-change-me';

function sign(text: string): string {
  return createHmac('sha256', QR_HMAC_SECRET).update(text).digest('hex');
}

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

function upsertUser(phone: string, role: string, displayName: string): string {
  const r = db.prepare('SELECT id FROM User WHERE phone = ?').get(phone) as { id: string } | undefined;
  if (r) {
    db.prepare('UPDATE User SET role = ?, displayName = ? WHERE id = ?').run(role, displayName, r.id);
    return r.id;
  }
  const id = 'usr_' + randomBytes(8).toString('hex');
  db.prepare('INSERT INTO User (id, phone, role, displayName) VALUES (?, ?, ?, ?)').run(id, phone, role, displayName);
  return id;
}

function upsertSku(s: {
  id: string; sku: string; serial: string; batch: string; mfgDate: string;
  modelName: string; family: string; capacity: string; voltage: string; chemistry: string; cycles: string;
  warrantyMonthsWhole: number; warrantyMonthsCell: number; warrantyMonthsBms: number; warrantyMonthsParts: number;
}) {
  const exists = db.prepare('SELECT id FROM Sku WHERE id = ?').get(s.id);
  if (!exists) {
    db.prepare(
      `INSERT INTO Sku (id, sku, serial, batch, mfgDate, modelName, family, capacity, voltage, chemistry, cycles,
                        warrantyMonthsWhole, warrantyMonthsCell, warrantyMonthsBms, warrantyMonthsParts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(s.id, s.sku, s.serial, s.batch, new Date(s.mfgDate).toISOString(), s.modelName,
          s.family, s.capacity, s.voltage, s.chemistry, s.cycles,
          s.warrantyMonthsWhole, s.warrantyMonthsCell, s.warrantyMonthsBms, s.warrantyMonthsParts);
  }
}

function ensureQr(skuId: string, serial: string, batch: string) {
  const exists = db.prepare('SELECT qrId FROM QrSignature WHERE qrId = ?').get(skuId);
  if (exists) return false;
  const nonce = randomBytes(6).toString('hex');
  const text = `${skuId}|${serial}|${batch}|${nonce}`;
  const sig = sign(text);
  db.prepare('INSERT INTO QrSignature (id, qrId, skuId, signature) VALUES (?, ?, ?, ?)')
    .run('qr_' + randomBytes(8).toString('hex'), skuId, skuId, sig);
  return true;
}

function upsertWarranty(w: any) {
  const exists = db.prepare('SELECT id FROM Warranty WHERE id = ?').get(w.id);
  if (exists) return;
  db.prepare(
    `INSERT INTO Warranty (id, skuId, userId, country, city, dealerName, invoiceNo, invoiceDate, invoiceAmount,
                          status, startAt, endAtWhole, endAtCell, endAtBms, endAtParts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    w.id, w.skuId, w.userId, w.country, w.city, w.dealerName ?? null,
    w.invoiceNo ?? null, w.invoiceDate, w.invoiceAmount,
    w.status, w.startAt, w.endAtWhole, w.endAtCell, w.endAtBms, w.endAtParts,
  );
}

function upsertDevice(d: any) {
  const exists = db.prepare('SELECT id FROM Device WHERE id = ?').get(d.id);
  if (exists) {
    db.prepare(
      `UPDATE Device SET soh = ?, soc = ?, cycles = ?, temp = ?, volt = ?, curr = ?, fw = ?, alarms = ?, lastSeenAt = CURRENT_TIMESTAMP WHERE id = ?`,
    ).run(d.soh, d.soc, d.cycles, d.temp, d.volt, d.curr, d.fw, d.alarms, d.id);
    return;
  }
  db.prepare(
    `INSERT INTO Device (id, skuId, userId, soh, soc, cycles, temp, volt, curr, fw, alarms, lastSeenAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
  ).run(d.id, d.skuId, d.userId, d.soh, d.soc, d.cycles, d.temp, d.volt, d.curr, d.fw, d.alarms);
}

console.log('🌱 Matoo Power API · seeding demo data ...');

const admin = upsertUser('+8801000000001', 'admin', 'Demo Admin');
const customer = upsertUser('+8801000000002', 'customer', 'Demo Customer');
const dealer = upsertUser('+8801000000003', 'dealer', 'Demo Dealer (BD)');
console.log(`  · users: admin=${admin.slice(0, 16)}…, customer=${customer.slice(0, 16)}…, dealer=${dealer.slice(0, 16)}…`);

const skuSeeds = [
  { id: 'MATO-MAT12200-DEMO0001', sku: 'MAT-12V200Ah', serial: 'SN24B0801A0001', batch: 'B202408-A', mfgDate: '2024-08-12', modelName: 'Matoo Power 12V 200Ah LiFePO4 Battery', family: 'battery', capacity: '200 Ah / 2560 Wh', voltage: '12.8 V', chemistry: 'LiFePO4 (A-grade)', cycles: '≥ 6000 @ 80% DoD', warrantyMonthsWhole: 36, warrantyMonthsCell: 60, warrantyMonthsBms: 36, warrantyMonthsParts: 12 },
  { id: 'MATO-MAT12200-DEMO0002', sku: 'MAT-12V200Ah', serial: 'SN24B0801A0002', batch: 'B202408-A', mfgDate: '2024-08-12', modelName: 'Matoo Power 12V 200Ah LiFePO4 Battery', family: 'battery', capacity: '200 Ah / 2560 Wh', voltage: '12.8 V', chemistry: 'LiFePO4 (A-grade)', cycles: '≥ 6000 @ 80% DoD', warrantyMonthsWhole: 36, warrantyMonthsCell: 60, warrantyMonthsBms: 36, warrantyMonthsParts: 12 },
  { id: 'MATO-MAT12200-DEMO0003', sku: 'MAT-12V200Ah', serial: 'SN24B0801A0003', batch: 'B202408-B', mfgDate: '2024-08-20', modelName: 'Matoo Power 12V 200Ah LiFePO4 Battery', family: 'battery', capacity: '200 Ah / 2560 Wh', voltage: '12.8 V', chemistry: 'LiFePO4 (A-grade)', cycles: '≥ 6000 @ 80% DoD', warrantyMonthsWhole: 36, warrantyMonthsCell: 60, warrantyMonthsBms: 36, warrantyMonthsParts: 12 },
  { id: 'MATO-MAT12300-DEMO0004', sku: 'MAT-12V300Ah', serial: 'SN24B0801A0004', batch: 'B202408-A', mfgDate: '2024-08-05', modelName: 'Matoo Power 12V 300Ah LiFePO4 Battery', family: 'battery', capacity: '300 Ah / 3840 Wh', voltage: '12.8 V', chemistry: 'LiFePO4 (A-grade)', cycles: '≥ 6000 @ 80% DoD', warrantyMonthsWhole: 36, warrantyMonthsCell: 60, warrantyMonthsBms: 36, warrantyMonthsParts: 12 },
];

let qrCount = 0;
for (const s of skuSeeds) {
  upsertSku(s);
  if (ensureQr(s.id, s.serial, s.batch)) {
    qrCount++;
    console.log(`  · qr signed: ${s.id}`);
  }
}

upsertWarranty({ id: 'warranty-seed-0001', skuId: 'MATO-MAT12200-DEMO0002', userId: customer, country: 'BD', city: 'Dhaka', dealerName: 'Matoo BD', invoiceNo: 'INV-DEMO-001', invoiceDate: '2025-01-14', invoiceAmount: 76000, status: 'active', startAt: '2025-01-14', endAtWhole: '2028-01-14', endAtCell: '2030-01-14', endAtBms: '2028-01-14', endAtParts: '2026-01-14' });
upsertWarranty({ id: 'warranty-seed-0002', skuId: 'MATO-MAT12200-DEMO0003', userId: customer, country: 'IN', city: 'Kolkata', dealerName: 'Matoo IN', invoiceNo: 'INV-DEMO-002', invoiceDate: '2024-12-05', invoiceAmount: 76000, status: 'active', startAt: '2024-12-05', endAtWhole: '2027-12-05', endAtCell: '2029-12-05', endAtBms: '2027-12-05', endAtParts: '2025-12-05' });
upsertWarranty({ id: 'warranty-seed-0003', skuId: 'MATO-MAT12300-DEMO0004', userId: customer, country: 'BD', city: 'Chattogram', dealerName: 'Matoo BD', invoiceNo: 'INV-DEMO-003', invoiceDate: '2024-09-20', invoiceAmount: 112000, status: 'active', startAt: '2024-09-20', endAtWhole: '2027-09-20', endAtCell: '2029-09-20', endAtBms: '2027-09-20', endAtParts: '2025-09-20' });

upsertDevice({ id: 'dev-1', skuId: 'MATO-MAT12200-DEMO0002', userId: customer, soh: 98, soc: 84, cycles: 312, temp: 26, volt: 13.1, curr: 0.0, fw: 'v1.2.4', alarms: 0 });
upsertDevice({ id: 'dev-2', skuId: 'MATO-MAT12200-DEMO0003', userId: customer, soh: 91, soc: 62, cycles: 1240, temp: 31, volt: 12.9, curr: 4.6, fw: 'v1.2.3', alarms: 2 });
upsertDevice({ id: 'dev-3', skuId: 'MATO-MAT12300-DEMO0004', userId: customer, soh: 99, soc: 100, cycles: 88, temp: 24, volt: 13.4, curr: 0.0, fw: 'v1.2.5', alarms: 0 });

db.prepare('UPDATE Sku SET activated = 1, activatedAt = ?, activatedByUserId = ? WHERE id = ?').run('2025-01-14T10:23:00Z', customer, 'MATO-MAT12200-DEMO0002');
db.prepare('UPDATE Sku SET activated = 1, activatedAt = ?, activatedByUserId = ? WHERE id = ?').run('2024-12-05T09:11:00Z', customer, 'MATO-MAT12200-DEMO0003');
db.prepare('UPDATE Sku SET activated = 1, activatedAt = ?, activatedByUserId = ? WHERE id = ?').run('2024-09-20T16:02:00Z', customer, 'MATO-MAT12300-DEMO0004');

console.log(`🌱 done. users=3, skus=4, qrSigned=${qrCount}, warranties=3, devices=3`);
db.close();
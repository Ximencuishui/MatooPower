// 简化 seed：直接走 node:sqlite + crypto（绕过 @prisma/client 生成步骤）
// 用于沙盒受限场景的幂等填充。完整 seed.ts 走 prisma client 见 prisma/seed.ts。

require('dotenv').config({ path: require('path').join(process.cwd(), '.env') });
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(process.env.DEV_DB || path.join(process.cwd(), 'prisma', 'dev.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

const QR_HMAC_SECRET = process.env.QR_HMAC_SECRET || 'dev-only-secret-change-me';
const signQr = (t) => crypto.createHmac('sha256', QR_HMAC_SECRET).update(t).digest('hex');

function upsertUser(phone, role, displayName) {
  const existing = db.prepare('SELECT id FROM User WHERE phone = ?').get(phone);
  if (existing) {
    db.prepare('UPDATE User SET role = ?, displayName = ? WHERE id = ?').run(role, displayName, existing.id);
    return existing.id;
  }
  const id = 'usr_' + crypto.randomBytes(8).toString('hex');
  db.prepare('INSERT INTO User (id, phone, role, displayName) VALUES (?, ?, ?, ?)').run(id, phone, role, displayName);
  return id;
}

function upsertSku(s) {
  const existing = db.prepare('SELECT id FROM Sku WHERE id = ?').get(s.id);
  if (existing) {
    db.prepare(`UPDATE Sku SET sku=?, serial=?, batch=?, mfgDate=?, modelName=?, family=?, capacity=?, voltage=?, chemistry=?, cycles=?, warrantyMonthsWhole=?, warrantyMonthsCell=?, warrantyMonthsBms=?, warrantyMonthsParts=? WHERE id=?`)
      .run(s.sku, s.serial, s.batch, s.mfgDate.toISOString(), s.modelName, s.family, s.capacity, s.voltage, s.chemistry, s.cycles, s.warrantyMonthsWhole, s.warrantyMonthsCell, s.warrantyMonthsBms, s.warrantyMonthsParts, s.id);
    return;
  }
  db.prepare(`INSERT INTO Sku (id, sku, serial, batch, mfgDate, modelName, family, capacity, voltage, chemistry, cycles, warrantyMonthsWhole, warrantyMonthsCell, warrantyMonthsBms, warrantyMonthsParts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(s.id, s.sku, s.serial, s.batch, s.mfgDate.toISOString(), s.modelName, s.family, s.capacity, s.voltage, s.chemistry, s.cycles, s.warrantyMonthsWhole, s.warrantyMonthsCell, s.warrantyMonthsBms, s.warrantyMonthsParts);
}

function upsertQr(qrId, skuId) {
  const existing = db.prepare('SELECT id FROM QrSignature WHERE qrId = ?').get(qrId);
  if (existing) return false;
  const nonce = crypto.randomBytes(6).toString('hex');
  const payload = `${skuId}|${qrId.split(':')[0]}|${nonce}`;
  // 演示：payload 直接用 skuId（与 seed.ts 一致）
  const skuRow = db.prepare('SELECT serial, batch FROM Sku WHERE id = ?').get(skuId);
  const text = `${skuId}|${skuRow.serial}|${skuRow.batch}|${nonce}`;
  const sig = signQr(text);
  const id = 'qr_' + crypto.randomBytes(8).toString('hex');
  db.prepare('INSERT INTO QrSignature (id, qrId, skuId, signature) VALUES (?, ?, ?, ?)').run(id, qrId, skuId, sig);
  return sig;
}

function upsertWarranty(w) {
  const existing = db.prepare('SELECT id FROM Warranty WHERE id = ?').get(w.id);
  if (existing) return;
  db.prepare(`INSERT INTO Warranty (id, skuId, userId, country, city, dealerName, invoiceNo, invoiceDate, invoiceAmount, status, startAt, endAtWhole, endAtCell, endAtBms, endAtParts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(w.id, w.skuId, w.userId, w.country, w.city, w.dealerName, w.invoiceNo, w.invoiceDate.toISOString(), w.invoiceAmount, w.status, w.startAt.toISOString(), w.endAtWhole.toISOString(), w.endAtCell.toISOString(), w.endAtBms.toISOString(), w.endAtParts.toISOString());
}

function upsertDevice(d) {
  const existing = db.prepare('SELECT id FROM Device WHERE id = ?').get(d.id);
  if (existing) {
    db.prepare(`UPDATE Device SET soh=?, soc=?, cycles=?, temp=?, volt=?, curr=?, fw=?, alarms=?, lastSeenAt=CURRENT_TIMESTAMP WHERE id=?`)
      .run(d.soh, d.soc, d.cycles, d.temp, d.volt, d.curr, d.fw, d.alarms, d.id);
    return;
  }
  db.prepare(`INSERT INTO Device (id, skuId, userId, soh, soc, cycles, temp, volt, curr, fw, alarms, lastSeenAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
    .run(d.id, d.skuId, d.userId, d.soh, d.soc, d.cycles, d.temp, d.volt, d.curr, d.fw, d.alarms);
}

(function main() {
  console.log('🌱 Matoo Power API · seeding demo data ...');
  const admin = upsertUser('+8801000000001', 'admin', 'Demo Admin');
  const customer = upsertUser('+8801000000002', 'customer', 'Demo Customer');
  const dealer = upsertUser('+8801000000003', 'dealer', 'Demo Dealer (BD)');
  console.log(`  · users: admin=${admin.slice(0,12)}…, customer=${customer.slice(0,12)}…, dealer=${dealer.slice(0,12)}…`);

  const skuSeeds = [
    { id: 'MATO-MAT12200-DEMO0001', sku: 'MAT-12V200Ah', serial: 'SN24B0801A0001', batch: 'B202408-A', mfgDate: new Date('2024-08-12'), modelName: 'Matoo Power 12V 200Ah LiFePO4 Battery', family: 'battery', capacity: '200 Ah / 2560 Wh', voltage: '12.8 V', chemistry: 'LiFePO4 (A-grade)', cycles: '≥ 6000 @ 80% DoD', warrantyMonthsWhole: 36, warrantyMonthsCell: 60, warrantyMonthsBms: 36, warrantyMonthsParts: 12 },
    { id: 'MATO-MAT12200-DEMO0002', sku: 'MAT-12V200Ah', serial: 'SN24B0801A0002', batch: 'B202408-A', mfgDate: new Date('2024-08-12'), modelName: 'Matoo Power 12V 200Ah LiFePO4 Battery', family: 'battery', capacity: '200 Ah / 2560 Wh', voltage: '12.8 V', chemistry: 'LiFePO4 (A-grade)', cycles: '≥ 6000 @ 80% DoD', warrantyMonthsWhole: 36, warrantyMonthsCell: 60, warrantyMonthsBms: 36, warrantyMonthsParts: 12 },
    { id: 'MATO-MAT12200-DEMO0003', sku: 'MAT-12V200Ah', serial: 'SN24B0801A0003', batch: 'B202408-B', mfgDate: new Date('2024-08-20'), modelName: 'Matoo Power 12V 200Ah LiFePO4 Battery', family: 'battery', capacity: '200 Ah / 2560 Wh', voltage: '12.8 V', chemistry: 'LiFePO4 (A-grade)', cycles: '≥ 6000 @ 80% DoD', warrantyMonthsWhole: 36, warrantyMonthsCell: 60, warrantyMonthsBms: 36, warrantyMonthsParts: 12 },
    { id: 'MATO-MAT12300-DEMO0004', sku: 'MAT-12V300Ah', serial: 'SN24B0801A0004', batch: 'B202408-A', mfgDate: new Date('2024-08-05'), modelName: 'Matoo Power 12V 300Ah LiFePO4 Battery', family: 'battery', capacity: '300 Ah / 3840 Wh', voltage: '12.8 V', chemistry: 'LiFePO4 (A-grade)', cycles: '≥ 6000 @ 80% DoD', warrantyMonthsWhole: 36, warrantyMonthsCell: 60, warrantyMonthsBms: 36, warrantyMonthsParts: 12 },
  ];

  let qrCount = 0;
  for (const s of skuSeeds) {
    upsertSku(s);
    const sig = upsertQr(s.id, s.id);
    if (sig) { qrCount++; console.log(`  · qr signed: ${s.id}  sig=${sig.slice(0,12)}…`); }
    else console.log(`  · qr exists: ${s.id}`);
  }

  upsertWarranty({ id: 'warranty-seed-0001', skuId: 'MATO-MAT12200-DEMO0002', userId: customer, country: 'BD', city: 'Dhaka', dealerName: 'Matoo BD', invoiceNo: 'INV-DEMO-001', invoiceDate: new Date('2025-01-14'), invoiceAmount: 76000, status: 'active', startAt: new Date('2025-01-14'), endAtWhole: new Date('2028-01-14'), endAtCell: new Date('2030-01-14'), endAtBms: new Date('2028-01-14'), endAtParts: new Date('2026-01-14') });
  upsertWarranty({ id: 'warranty-seed-0002', skuId: 'MATO-MAT12200-DEMO0003', userId: customer, country: 'IN', city: 'Kolkata', dealerName: 'Matoo IN', invoiceNo: 'INV-DEMO-002', invoiceDate: new Date('2024-12-05'), invoiceAmount: 76000, status: 'active', startAt: new Date('2024-12-05'), endAtWhole: new Date('2027-12-05'), endAtCell: new Date('2029-12-05'), endAtBms: new Date('2027-12-05'), endAtParts: new Date('2025-12-05') });
  upsertWarranty({ id: 'warranty-seed-0003', skuId: 'MATO-MAT12300-DEMO0004', userId: customer, country: 'BD', city: 'Chattogram', dealerName: 'Matoo BD', invoiceNo: 'INV-DEMO-003', invoiceDate: new Date('2024-09-20'), invoiceAmount: 112000, status: 'active', startAt: new Date('2024-09-20'), endAtWhole: new Date('2027-09-20'), endAtCell: new Date('2029-09-20'), endAtBms: new Date('2027-09-20'), endAtParts: new Date('2025-09-20') });

  upsertDevice({ id: 'dev-1', skuId: 'MATO-MAT12200-DEMO0002', userId: customer, soh: 98, soc: 84, cycles: 312, temp: 26, volt: 13.1, curr: 0.0, fw: 'v1.2.4', alarms: 0 });
  upsertDevice({ id: 'dev-2', skuId: 'MATO-MAT12200-DEMO0003', userId: customer, soh: 91, soc: 62, cycles: 1240, temp: 31, volt: 12.9, curr: 4.6, fw: 'v1.2.3', alarms: 2 });
  upsertDevice({ id: 'dev-3', skuId: 'MATO-MAT12300-DEMO0004', userId: customer, soh: 99, soc: 100, cycles: 88, temp: 24, volt: 13.4, curr: 0.0, fw: 'v1.2.5', alarms: 0 });

  // 标记已激活
  db.prepare("UPDATE Sku SET activated=1, activatedAt=?, activatedByUserId=? WHERE id=?").run(new Date('2025-01-14T10:23:00Z').toISOString(), customer, 'MATO-MAT12200-DEMO0002');
  db.prepare("UPDATE Sku SET activated=1, activatedAt=?, activatedByUserId=? WHERE id=?").run(new Date('2024-12-05T09:11:00Z').toISOString(), customer, 'MATO-MAT12200-DEMO0003');
  db.prepare("UPDATE Sku SET activated=1, activatedAt=?, activatedByUserId=? WHERE id=?").run(new Date('2024-09-20T16:02:00Z').toISOString(), customer, 'MATO-MAT12300-DEMO0004');

  // 演示工单
  function upsertTicket(t) {
    const exists = db.prepare('SELECT id FROM Ticket WHERE id = ?').get(t.id);
    if (!exists) {
      db.prepare(`INSERT INTO Ticket (id, userId, skuId, deviceId, type, severity, subject, description, contactPhone, status, assigneeUserId, resolution, resolvedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(t.id, t.userId, t.skuId ?? null, t.deviceId ?? null, t.type, t.severity, t.subject, t.description, t.contactPhone ?? null, t.status, t.assigneeUserId ?? null, t.resolution ?? null, t.resolvedAt ?? null, t.createdAt, t.updatedAt);
    }
  }
  function upsertTicketMessage(m) {
    const exists = db.prepare('SELECT id FROM TicketMessage WHERE id = ?').get(m.id);
    if (!exists) {
      db.prepare(`INSERT INTO TicketMessage (id, ticketId, senderUserId, senderRole, body, createdAt) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(m.id, m.ticketId, m.senderUserId ?? null, m.senderRole, m.body, m.createdAt);
    }
  }

  const t1Created = '2025-02-10T09:30:00Z';
  const t2Created = '2025-03-05T14:22:00Z';
  upsertTicket({ id: 'ticket-demo-0001', userId: customer, skuId: 'MATO-MAT12200-DEMO0002', deviceId: 'dev-1', type: 'warranty', severity: 'normal', subject: '电池容量明显下降', description: '设备使用半年，电池容量感觉下降到原来的 80% 左右，能否安排检测？', contactPhone: '+8801000000002', status: 'in_progress', assigneeUserId: admin, createdAt: t1Created, updatedAt: t1Created });
  upsertTicketMessage({ id: 'tm-1', ticketId: 'ticket-demo-0001', senderUserId: customer, senderRole: 'customer', body: '已上传使用日志，请查收。', createdAt: t1Created });
  upsertTicketMessage({ id: 'tm-2', ticketId: 'ticket-demo-0001', senderUserId: admin, senderRole: 'support', body: '已收到，请保持设备有 30% 以上电量等待远程诊断。', createdAt: '2025-02-10T11:00:00Z' });

  upsertTicket({ id: 'ticket-demo-0002', userId: customer, skuId: null, deviceId: null, type: 'inquiry', severity: 'low', subject: '是否有兼容的太阳能板配件？', description: '想咨询 200W 单晶硅太阳能板是否在配件列表里。', contactPhone: '+8801000000002', status: 'resolved', assigneeUserId: admin, resolution: '已回复客户，推荐 MAT-SP200。', resolvedAt: '2025-03-06T10:00:00Z', createdAt: t2Created, updatedAt: '2025-03-06T10:00:00Z' });
  upsertTicketMessage({ id: 'tm-3', ticketId: 'ticket-demo-0002', senderUserId: customer, senderRole: 'customer', body: '想咨询 200W 单晶硅太阳能板是否在配件列表里。', createdAt: t2Created });
  upsertTicketMessage({ id: 'tm-4', ticketId: 'ticket-demo-0002', senderUserId: admin, senderRole: 'support', body: '有的，型号 MAT-SP200，200W 单晶硅，含 MC4 连接器。', createdAt: '2025-03-06T09:30:00Z' });
  upsertTicketMessage({ id: 'tm-5', ticketId: 'ticket-demo-0002', senderUserId: admin, senderRole: 'support', body: '工单已解决，欢迎回购。', createdAt: '2025-03-06T10:00:00Z' });

  console.log(`🌱 done. users=3, skus=4, qrSigned=${qrCount}, warranties=3, devices=3, tickets=2`);
})();
// 用 Node 24 内置 node:sqlite 查数据库结构
const { DatabaseSync } = require('node:sqlite');
try {
  const db = new DatabaseSync('./dev.db', { readOnly: true });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('=== Tables (' + tables.length + ') ===');
  for (const t of tables) console.log(' - ' + t.name);
  console.log('');

  for (const t of ['AuditLog', 'WarrantyReviewLog', 'TicketStatusLog', 'User', 'Sku', 'Warranty', 'Device', 'Ticket']) {
    try {
      const c = db.prepare('SELECT COUNT(*) as c FROM ' + t).get();
      console.log(' * ' + t + ' = ' + c.c + ' rows');
    } catch (e) {
      console.log(' * ' + t + ' = (no table)');
    }
  }
  console.log('');
  console.log('=== Recent AuditLog (5) ===');
  try {
    const rows = db.prepare("SELECT id, actorRole, action, resource, createdAt FROM AuditLog ORDER BY createdAt DESC LIMIT 5").all();
    for (const r of rows) console.log(JSON.stringify(r));
  } catch (e) { console.log('(none)'); }
  console.log('');
  console.log('=== Recent WarrantyReviewLog (5) ===');
  try {
    const rows = db.prepare('SELECT * FROM WarrantyReviewLog ORDER BY createdAt DESC LIMIT 5').all();
    for (const r of rows) console.log(JSON.stringify(r));
  } catch (e) { console.log('(none)'); }
} catch (e) {
  console.error('ERR:', e.message);
}
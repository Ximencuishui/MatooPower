// v1.3 P0 e2e:SKU 批次 CRUD + 校验
// 每个测试用独立 db + 独立 app(避免 shared app 跨文件状态污染)
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import request from 'supertest';
import { makeTmpDb, initDb, startApp, loginAndGetToken, type AppHandle } from './helpers';

function runSql(dbFile: string, sql: string, ...params: (string | number | null)[]) {
  const script = path.join(process.env.TEMP || '/tmp', `sql-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.cjs`);
  fs.writeFileSync(script, `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(${JSON.stringify(dbFile)});
db.prepare(${JSON.stringify(sql)}).run(${params.map((p) => JSON.stringify(p)).join(', ')});
`);
  try {
    execSync(`node "${script}"`, { encoding: 'utf8' });
  } finally {
    fs.unlinkSync(script);
  }
}

async function setupFreshApp(): Promise<AppHandle> {
  const dbFile = makeTmpDb();
  initDb(dbFile);
  return await startApp();
}

async function loginAdmin(handle: AppHandle, phone: string): Promise<string> {
  await loginAndGetToken(phone);
  const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
  runSql(dbFile, "UPDATE User SET role='admin' WHERE phone=?", phone);
  return loginAndGetToken(phone);
}

function insertSku(dbFile: string, id: string, batchId: string | null) {
  runSql(
    dbFile,
    `INSERT INTO Sku (id, sku, serial, batch, batchId, mfgDate, modelName, family, capacity, voltage, chemistry, cycles,
                      warrantyMonthsWhole, warrantyMonthsCell, warrantyMonthsBms, warrantyMonthsParts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, 'MAT-12V200Ah', `SN-${id}`, 'B202609-E', batchId, '2026-09-01T00:00:00Z',
    'E2E Battery', 'battery', '200 Ah', '12.8 V', 'LiFePO4', '6000',
    36, 60, 36, 12,
  );
}

describe('SKU Batch (v1.3 P0) e2e', () => {
  let h: AppHandle;
  afterEach(async () => { if (h) await h.close(); });

  it('T1: admin create + list + get + patch', async () => {
    h = await setupFreshApp();
    const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
    const token = await loginAdmin(h, '+8801711111001');

    // create
    const c = await h.req.post('/admin/sku-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchCode: 'BATCH-2026Q3-001',
        mfgDate: '2026-09-15T00:00:00Z',
        factory: 'Matoo Plant A',
        destinationCountry: 'BD',
        totalQuantity: 500,
        note: 'Q3 ship',
      });
    expect(c.status).toBe(201);
    expect(c.body.ok).toBe(true);
    expect(c.body.batch.batchCode).toBe('BATCH-2026Q3-001');
    expect(c.body.batch.id).toBeDefined();
    const id = c.body.batch.id;

    // list — withStats 版本
    const l = await h.req.get('/admin/sku-batch?pageSize=50')
      .set('Authorization', `Bearer ${token}`);
    expect(l.status).toBe(200);
    const found = l.body.items.find((b: any) => b.id === id);
    expect(found).toBeDefined();
    expect(found.skuCount).toBe(0);

    // get
    const g = await h.req.get(`/admin/sku-batch/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(g.status).toBe(200);
    expect(g.body.batch.factory).toBe('Matoo Plant A');
    expect(g.body.batch.skuCount).toBe(0);

    // patch
    const p = await h.req.patch(`/admin/sku-batch/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ factory: 'Matoo Plant B', note: 'Updated' });
    expect(p.status).toBe(200);
    expect(p.body.batch.factory).toBe('Matoo Plant B');
    expect(p.body.batch.note).toBe('Updated');
  });

  it('T2: batchCode 唯一性校验 — 重复创建返回 409 或 500', async () => {
    h = await setupFreshApp();
    const token = await loginAdmin(h, '+8801711111002');
    const body = { batchCode: 'BATCH-2026Q3-002', mfgDate: '2026-09-15T00:00:00Z' };
    const r1 = await h.req.post('/admin/sku-batch').set('Authorization', `Bearer ${token}`).send(body);
    expect(r1.status).toBe(201);
    const r2 = await h.req.post('/admin/sku-batch').set('Authorization', `Bearer ${token}`).send(body);
    expect([409, 500]).toContain(r2.status);
  });

  it('T3: 格式校验 — batchCode 不匹配正则返回 400', async () => {
    h = await setupFreshApp();
    const token = await loginAdmin(h, '+8801711111003');
    const r = await h.req.post('/admin/sku-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ batchCode: 'WRONG-CODE', mfgDate: '2026-09-15T00:00:00Z' });
    expect(r.status).toBe(400);
  });

  it('T4: 关联 SKU 后不能删除 — 返回 400', async () => {
    h = await setupFreshApp();
    const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
    const token = await loginAdmin(h, '+8801711111004');
    const c = await h.req.post('/admin/sku-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ batchCode: 'BATCH-2026Q3-003', mfgDate: '2026-09-15T00:00:00Z' });
    expect(c.status).toBe(201);
    const batchId = c.body.batch.id;

    insertSku(dbFile, 'sku-test-001', batchId);

    const d = await h.req.delete(`/admin/sku-batch/${batchId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(d.status).toBe(400);
  });

  it('T5: 无关联时软删 — 返回 200', async () => {
    h = await setupFreshApp();
    const token = await loginAdmin(h, '+8801711111005');
    const c = await h.req.post('/admin/sku-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ batchCode: 'BATCH-2026Q3-004', mfgDate: '2026-09-15T00:00:00Z' });
    expect(c.status).toBe(201);
    const id = c.body.batch.id;
    const d = await h.req.delete(`/admin/sku-batch/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(d.status).toBe(200);
  });

  it('T6: RBAC — customer 调 /admin/sku-batch 返回 403', async () => {
    h = await setupFreshApp();
    const token = await loginAndGetToken('+8801711111006');
    const r = await h.req.post('/admin/sku-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ batchCode: 'BATCH-2026Q3-005', mfgDate: '2026-09-15T00:00:00Z' });
    expect(r.status).toBe(403);
  });
});
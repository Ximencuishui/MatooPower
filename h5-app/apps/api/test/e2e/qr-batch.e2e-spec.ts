// v1.3 P0 e2e:QR 批量生成 + 撤销
// 每个测试用独立 db + 独立 app(避免 shared app 跨文件状态污染)
// admin token 通过直接 DB 写入 + JwtService 签发(避开跨 app OTP 500 问题)
import * as path from 'path';
import { execSync } from 'child_process';
import request from 'supertest';
import { makeTmpDb, initDb, startApp, loginAndGetToken, mintAdminToken, type AppHandle } from './helpers';

function runSql(dbFile: string, sql: string, ...params: (string | number | null)[]) {
  const script = path.join(process.env.TEMP || '/tmp', `sql-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.cjs`);
  const fs = require('fs');
  fs.writeFileSync(script, `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(${JSON.stringify(dbFile)});
db.prepare(${JSON.stringify(sql)}).run(${params.map((p) => JSON.stringify(p)).join(', ')});
`);
  try {
    execSync(`node "${script}"`, { encoding: 'utf8' });
  } finally {
    try { fs.unlinkSync(script); } catch {}
  }
}

async function setupFreshApp(): Promise<AppHandle> {
  const dbFile = makeTmpDb();
  initDb(dbFile);
  return await startApp();
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

/** 在 h 上直接 mint admin token(避开跨 app OTP 问题) */
async function adminTokenFor(h: AppHandle, phone: string): Promise<string> {
  return await mintAdminToken(h, phone);
}

async function setupBatchWithSkus(
  h: AppHandle,
  batchCode: string,
  skuCount: number,
): Promise<{ batchId: string; token: string }> {
  const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
  const token = await adminTokenFor(h, '+8801733333000');
  const c = await h.req.post('/admin/sku-batch')
    .set('Authorization', `Bearer ${token}`)
    .send({ batchCode, mfgDate: '2026-09-15T00:00:00Z' });
  if (c.status !== 201) {
    throw new Error(`setupBatchWithSkus 失败: ${c.status} ${JSON.stringify(c.body)}`);
  }
  const batchId = c.body.batch.id;
  for (let i = 0; i < skuCount; i++) insertSku(dbFile, `sku-qr-${batchCode}-${i}`, batchId);
  return { batchId, token };
}

describe('QR Batch (v1.3 P0) e2e', () => {
  let h: AppHandle;
  afterEach(async () => { if (h) await h.close(); });

  it('T1: 批量生成 → 任务完成 + ZIP 可下载', async () => {
    h = await setupFreshApp();
    const { batchId, token } = await setupBatchWithSkus(h, 'BATCH-2026Q3-001', 2);

    const r = await h.req.post('/admin/qr-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ batchId, quantity: 4 });
    expect(r.status).toBe(201);
    expect(r.body.task.status).toMatch(/pending|running|done/);
    const taskId = r.body.task.id;

    // 轮询直到完成(最多 5 秒)
    let task: any = r.body.task;
    for (let i = 0; i < 20 && task.status !== 'done' && task.status !== 'failed'; i++) {
      await new Promise((res) => setTimeout(res, 250));
      const g = await h.req.get(`/admin/qr-batch/${taskId}`).set('Authorization', `Bearer ${token}`);
      task = g.body.task;
    }
    expect(task.status).toBe('done');
    expect(task.generatedCount).toBe(4);
    expect(task.zipStorageKey).not.toBeNull();

    const dl = await h.req.get(`/admin/qr-batch/${taskId}/download`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(dl.status).toBe(200);
    expect(dl.headers['content-type']).toBe('application/zip');
    expect(Buffer.isBuffer(dl.body)).toBe(true);
    expect((dl.body as Buffer).length).toBeGreaterThan(0);
    // 验证是合法 ZIP(magic: PK\x03\x04)
    expect((dl.body as Buffer).slice(0, 4).toString('hex')).toBe('504b0304');
  });

  it('T2: quantity 超 5000 → 400', async () => {
    h = await setupFreshApp();
    const { batchId, token } = await setupBatchWithSkus(h, 'BATCH-2026Q3-002', 1);

    const r = await h.req.post('/admin/qr-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ batchId, quantity: 6000 });
    expect(r.status).toBe(400);
  });

  it('T3: 批次无 SKU → 400', async () => {
    h = await setupFreshApp();
    const { batchId, token } = await setupBatchWithSkus(h, 'BATCH-2026Q3-003', 0);

    const r = await h.req.post('/admin/qr-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ batchId, quantity: 5 });
    expect(r.status).toBe(400);
  });

  it('T4: 撤销 QR → revoked=1', async () => {
    h = await setupFreshApp();
    const { batchId, token } = await setupBatchWithSkus(h, 'BATCH-2026Q3-004', 1);

    const trigger = await h.req.post('/admin/qr-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ batchId, quantity: 2 });
    const taskId = trigger.body.task.id;

    // 等完成
    for (let i = 0; i < 20; i++) {
      await new Promise((res) => setTimeout(res, 250));
      const g = await h.req.get(`/admin/qr-batch/${taskId}`).set('Authorization', `Bearer ${token}`);
      if (g.body.task.status === 'done' || g.body.task.status === 'failed') break;
    }

    // 取最新 qrId
    const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
    const qrId = execSync(
      `node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);const r=db.prepare(\\"SELECT qrId FROM QrSignature ORDER BY createdAt DESC LIMIT 1\\").get();console.log(r?r.qrId:'')" "${dbFile}"`,
      { encoding: 'utf8' },
    ).trim();
    expect(qrId).toBeTruthy();

    const rev = await h.req.post(`/admin/qr/${qrId}/revoke`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 201]).toContain(rev.status);

    // 已撤销的不可再次撤销
    const rev2 = await h.req.post(`/admin/qr/${qrId}/revoke`)
      .set('Authorization', `Bearer ${token}`);
    expect(rev2.status).toBeGreaterThanOrEqual(400);

    const list = await h.req.get('/admin/qr/revoked').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
  });

  it('T5: 列表任务 — 拉取所有历史任务', async () => {
    h = await setupFreshApp();
    const { batchId, token } = await setupBatchWithSkus(h, 'BATCH-2026Q3-005', 1);

    await h.req.post('/admin/qr-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ batchId, quantity: 1 });

    const list = await h.req.get('/admin/qr-batch').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('T6: RBAC — customer 调 /admin/qr-batch → 403', async () => {
    h = await setupFreshApp();
    const token = await loginAndGetToken('+8801733333006');
    const r = await h.req.post('/admin/qr-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ batchId: 'whatever', quantity: 1 });
    expect(r.status).toBe(403);
  });
});
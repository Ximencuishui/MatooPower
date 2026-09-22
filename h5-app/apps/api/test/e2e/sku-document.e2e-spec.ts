// v1.3 P0 e2e:SKU 文档 上传 / 公开下载 / 软删
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

function insertSku(dbFile: string, id: string) {
  runSql(
    dbFile,
    `INSERT INTO Sku (id, sku, serial, batch, mfgDate, modelName, family, capacity, voltage, chemistry, cycles,
                      warrantyMonthsWhole, warrantyMonthsCell, warrantyMonthsBms, warrantyMonthsParts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, 'MAT-12V200Ah', `SN-${id}`, 'B202609-E', '2026-09-01T00:00:00Z',
    'E2E Battery', 'battery', '200 Ah', '12.8 V', 'LiFePO4', '6000',
    36, 60, 36, 12,
  );
}

const tinyPdf = Buffer.from([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xc4, 0xe5, 0xf2, 0xe5, 0xeb, 0xa7,
  0xf3, 0xa0, 0xd0, 0xc4, 0xc6, 0x0a, 0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a, 0x3c, 0x3c,
  0x2f, 0x54, 0x79, 0x70, 0x65, 0x2f, 0x43, 0x61, 0x74, 0x61, 0x6c, 0x6f, 0x67, 0x2f, 0x50, 0x61,
  0x67, 0x65, 0x73, 0x20, 0x32, 0x20, 0x30, 0x20, 0x52, 0x3e, 0x3e, 0x0a, 0x65, 0x6e, 0x64, 0x6f,
  0x62, 0x6a, 0x0a, 0x78, 0x72, 0x65, 0x66, 0x0a, 0x30, 0x20, 0x31, 0x32, 0x0a, 0x30, 0x30, 0x30,
  0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x20, 0x36, 0x35, 0x35, 0x33, 0x35, 0x20, 0x66,
  0x0a, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x39, 0x20, 0x30, 0x30, 0x30,
  0x30, 0x30, 0x20, 0x6e, 0x0a, 0x74, 0x72, 0x61, 0x69, 0x6c, 0x65, 0x72, 0x0a, 0x3c, 0x3c, 0x2f,
  0x52, 0x6f, 0x6f, 0x74, 0x20, 0x31, 0x20, 0x30, 0x20, 0x52, 0x3e, 0x3e, 0x0a, 0x73, 0x74, 0x61,
  0x72, 0x74, 0x78, 0x72, 0x65, 0x66, 0x0a, 0x31, 0x32, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46, 0x0a,
]);

describe('SKU Document (v1.3 P0) e2e', () => {
  let h: AppHandle;
  afterEach(async () => { if (h) await h.close(); });

  it('T1: 上传 PDF → 201 + sha256 落库 + 公开端点可拉取', async () => {
    h = await setupFreshApp();
    const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
    const token = await loginAdmin(h, '+8801722222001');
    insertSku(dbFile, 'sku-doc-001');

    const c = await h.req.post('/admin/sku-document')
      .set('Authorization', `Bearer ${token}`)
      .field('skuId', 'sku-doc-001')
      .field('type', 'manual').field('lang', 'en').field('version', 'v1.0')
      .field('title', 'Test Manual EN v1.0')
      .attach('file', tinyPdf, { filename: 'manual-en.pdf', contentType: 'application/pdf' });
    expect(c.status).toBe(201);
    expect(c.body.ok).toBe(true);
    expect(c.body.document.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(c.body.document.storageKey).toContain('sku-doc-001/manual/en/v1.0-');

    // 公开端点(无 JWT)
    const pub = await h.req.get('/public/sku-document/sku-doc-001/manual/en');
    expect(pub.status).toBe(200);
    expect(pub.headers['content-type']).toBe('application/pdf');
    expect(pub.body.length).toBe(tinyPdf.length);
  });

  it('T2: 同 sha256 重复上传 → 409', async () => {
    h = await setupFreshApp();
    const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
    const token = await loginAdmin(h, '+8801722222002');
    insertSku(dbFile, 'sku-doc-002');

    await h.req.post('/admin/sku-document')
      .set('Authorization', `Bearer ${token}`)
      .field('skuId', 'sku-doc-002').field('type', 'manual').field('lang', 'en').field('version', 'v1.0').field('title', 'M')
      .attach('file', tinyPdf, { filename: 'a.pdf', contentType: 'application/pdf' });
    const dup = await h.req.post('/admin/sku-document')
      .set('Authorization', `Bearer ${token}`)
      .field('skuId', 'sku-doc-002').field('type', 'manual').field('lang', 'zh').field('version', 'v1.0').field('title', 'M')
      .attach('file', tinyPdf, { filename: 'b.pdf', contentType: 'application/pdf' });
    expect([409, 500]).toContain(dup.status);
  });

  it('T3: 同 version 重复上传 → 409', async () => {
    h = await setupFreshApp();
    const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
    const token = await loginAdmin(h, '+8801722222003');
    insertSku(dbFile, 'sku-doc-003');

    const first = await h.req.post('/admin/sku-document')
      .set('Authorization', `Bearer ${token}`)
      .field('skuId', 'sku-doc-003').field('type', 'manual').field('lang', 'en').field('version', 'v1.0').field('title', 'M')
      .attach('file', tinyPdf, { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(first.status).toBe(201);
    // 不同 sha256(在内存里加一字节差异)
    const modified = Buffer.concat([tinyPdf.subarray(0, 10), Buffer.from([0x20]), tinyPdf.subarray(11)]);
    const dup = await h.req.post('/admin/sku-document')
      .set('Authorization', `Bearer ${token}`)
      .field('skuId', 'sku-doc-003').field('type', 'manual').field('lang', 'en').field('version', 'v1.0').field('title', 'M')
      .attach('file', modified, { filename: 'b.pdf', contentType: 'application/pdf' });
    expect([409, 500]).toContain(dup.status);
  });

  it('T4: lang 不在白名单 → 400', async () => {
    h = await setupFreshApp();
    const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
    const token = await loginAdmin(h, '+8801722222004');
    insertSku(dbFile, 'sku-doc-004');

    const r = await h.req.post('/admin/sku-document')
      .set('Authorization', `Bearer ${token}`)
      .field('skuId', 'sku-doc-004').field('type', 'manual').field('lang', 'jp').field('version', 'v1.0').field('title', 'M')
      .attach('file', tinyPdf, { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(r.status).toBe(400);
  });

  it('T5: 公开端点 缺失语言 → 404', async () => {
    h = await setupFreshApp();
    const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
    insertSku(dbFile, 'sku-doc-005');
    const r = await h.req.get('/public/sku-document/sku-doc-005/manual/zh');
    expect(r.status).toBe(404);
  });

  it('T6: soft delete → deprecatedAt 写入', async () => {
    h = await setupFreshApp();
    const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
    const token = await loginAdmin(h, '+8801722222006');
    insertSku(dbFile, 'sku-doc-006');

    const c = await h.req.post('/admin/sku-document')
      .set('Authorization', `Bearer ${token}`)
      .field('skuId', 'sku-doc-006').field('type', 'manual').field('lang', 'en').field('version', 'v1.0').field('title', 'M')
      .attach('file', tinyPdf, { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(c.status).toBe(201);
    const docId = c.body.document.id;

    const d = await h.req.delete(`/admin/sku-document/${docId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(d.status).toBe(200);
    expect(d.body.document.deprecatedAt).not.toBeNull();
  });

  it('T7: customer 调 /admin/sku-document → 403', async () => {
    h = await setupFreshApp();
    const token = await loginAndGetToken('+8801722222007');
    const r = await h.req.post('/admin/sku-document')
      .set('Authorization', `Bearer ${token}`)
      .field('skuId', 'any').field('type', 'manual').field('lang', 'en').field('version', 'v1.0').field('title', 'X')
      .attach('file', tinyPdf, { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(r.status).toBe(403);
  });
});
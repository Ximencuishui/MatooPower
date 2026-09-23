// P1-2 v1.4:经销商独立 Dealer 表 E2E 测试
// 覆盖:POST 创建 / GET 列表 / PATCH 更新 / DELETE 软删 / RBAC / 价格增删

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { SECURITY_HEADERS } from '../../src/common/security';

function makeTmpDb() {
  return path.join(os.tmpdir(), `matoo-dealer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`);
}
function initDb(dbFile: string) {
  process.env.DATABASE_URL = `file:${dbFile}`;
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.QR_HMAC_SECRET = 'test-hmac-secret';
  process.env.OTP_TTL_SECONDS = '300';
  process.env.PORT = '0';
  process.env.NODE_ENV = 'test';
  const cwd = path.resolve(__dirname, '../..');
  execSync(`node "${path.join(cwd, 'prisma/init-sqlite.cjs')}" "${dbFile}"`, {
    env: { ...process.env },
    stdio: 'pipe',
  });
}
function cleanDb(dbFile: string) {
  for (const ext of ['', '-journal', '-wal', '-shm']) {
    try { fs.unlinkSync(dbFile + ext); } catch {}
  }
}
function insertUserRaw(dbFile: string, phone: string, role: 'admin' | 'customer' | 'dealer'): string {
  const id = `usr_${role}_${Math.random().toString(36).slice(2, 10)}`;
  const script = path.join(os.tmpdir(), `dlr-ins-${Date.now()}.cjs`);
  fs.writeFileSync(script, `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(${JSON.stringify(dbFile)});
db.prepare("INSERT INTO User (id, phone, role, displayName) VALUES (?, ?, ?, ?)").run(${JSON.stringify(id)}, ${JSON.stringify(phone)}, ${JSON.stringify(role)}, ${JSON.stringify('Demo ' + role)});
`);
  try {
    execSync(`node "${script}"`, { encoding: 'utf8', stdio: 'pipe' });
    return id;
  } finally {
    try { fs.unlinkSync(script); } catch {}
  }
}
function insertSkuRaw(dbFile: string, skuId: string): void {
  const script = path.join(os.tmpdir(), `dlr-sku-${Date.now()}.cjs`);
  fs.writeFileSync(script, `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(${JSON.stringify(dbFile)});
db.prepare(\`INSERT OR IGNORE INTO Sku (id, sku, serial, batch, mfgDate, modelName, family, capacity, voltage, chemistry, cycles, warrantyMonthsWhole) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`)
  .run(${JSON.stringify(skuId)}, 'TEST-' + ${JSON.stringify(skuId)}, 'SN-' + ${JSON.stringify(skuId)}, 'BATCH-TEST', new Date().toISOString(), 'Test Model', 'battery', '100Ah', '12V', 'LiFePO4', '6000', 36);
`);
  try {
    execSync(`node "${script}"`, { encoding: 'utf8', stdio: 'pipe' });
  } finally {
    try { fs.unlinkSync(script); } catch {}
  }
}

describe('P1-2 Dealer Admin (e2e)', () => {
  let dbFile: string;
  let app: INestApplication;
  let req: ReturnType<typeof request>;
  let jwt: JwtService;
  let adminToken: string;
  let customerToken: string;
  let adminId: string;
  let customerId: string;

  beforeAll(async () => {
    dbFile = makeTmpDb();
    initDb(dbFile);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ cors: false });
    app.use(helmet(SECURITY_HEADERS));
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    req = request(app.getHttpServer());
    jwt = app.get(JwtService);

    adminId = insertUserRaw(dbFile, '+8801000000300', 'admin');
    customerId = insertUserRaw(dbFile, '+8801000000301', 'customer');
    insertSkuRaw(dbFile, 'TEST-SKU-001');
    insertSkuRaw(dbFile, 'TEST-SKU-002');

    adminToken = await jwt.signAsync({ sub: adminId, role: 'admin', phone: '+8801000000300' }, { expiresIn: '7d' });
    customerToken = await jwt.signAsync({ sub: customerId, role: 'customer', phone: '+8801000000301' }, { expiresIn: '7d' });
  });

  afterAll(async () => {
    if (app) await app.close();
    cleanDb(dbFile);
  });

  it('① POST /admin/dealers → 201 创建 dealer', async () => {
    const r = await req.post('/admin/dealers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ companyName: 'Matoo BD Ltd', country: 'BD', tier: 'gold', contactEmail: 'bd@matoo.com' });
    expect(r.status).toBe(201);
    expect(r.body.ok).toBe(true);
    expect(r.body.dealer.companyName).toBe('Matoo BD Ltd');
    expect(r.body.dealer.tier).toBe('gold');
    expect(r.body.dealer.status).toBe('active');
  });

  it('② GET /admin/dealers → 200 列表', async () => {
    const r = await req.get('/admin/dealers?pageSize=10').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.items.length).toBeGreaterThanOrEqual(1);
    expect(r.body.total).toBeGreaterThanOrEqual(1);
  });

  it('③ PATCH /admin/dealers/:id → 200 更新', async () => {
    const list = await req.get('/admin/dealers?pageSize=1').set('Authorization', `Bearer ${adminToken}`);
    const dealerId = list.body.items[0].id;
    const r = await req.patch(`/admin/dealers/${dealerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tier: 'platinum', note: '升级' });
    expect(r.status).toBe(200);
    expect(r.body.dealer.tier).toBe('platinum');
    expect(r.body.dealer.note).toBe('升级');
  });

  it('④ DELETE /admin/dealers/:id → 软删 status=suspended', async () => {
    const list = await req.get('/admin/dealers?pageSize=1').set('Authorization', `Bearer ${adminToken}`);
    const dealerId = list.body.items[0].id;
    const r = await req.delete(`/admin/dealers/${dealerId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.dealer.status).toBe('suspended');
  });

  it('⑤ RBAC:customer 调 → 403', async () => {
    const r = await req.get('/admin/dealers').set('Authorization', `Bearer ${customerToken}`);
    expect(r.status).toBe(403);
  });

  it('⑥ 添加专属价 + 详情含 priceList', async () => {
    // 先创建一个新 dealer(避免上面被 suspend 的)
    const create = await req.post('/admin/dealers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ companyName: 'Matoo IN Pvt', country: 'IN', tier: 'silver' });
    const dealerId = create.body.dealer.id;

    const addPrice = await req.post(`/admin/dealers/${dealerId}/prices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ skuId: 'TEST-SKU-001', priceCents: 6500000, currency: 'BDT' });
    expect(addPrice.status).toBe(201);
    expect(addPrice.body.price.priceCents).toBe(6500000);

    const detail = await req.get(`/admin/dealers/${dealerId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.dealer.priceList.length).toBe(1);
    expect(detail.body.dealer.priceList[0].skuSku).toContain('TEST-SKU-001');

    // 删除价格
    const priceId = detail.body.dealer.priceList[0].id;
    const del = await req.delete(`/admin/dealers/${dealerId}/prices/${priceId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);

    const detail2 = await req.get(`/admin/dealers/${dealerId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(detail2.body.dealer.priceList.length).toBe(0);
  });
});
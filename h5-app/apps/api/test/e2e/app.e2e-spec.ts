// Matoo Power API — E2E 测试套件
// 覆盖：auth / sku / warranty / device / ticket / dealer / admin / swagger
// 设计：每个 describe 用自己的临时 SQLite DB；同一 describe 内复用 shared app 实例
// （避免每次 startApp 重新建 DbService 连接导致 SQLite 缓存问题）

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import request from 'supertest';
import {
  makeTmpDb,
  initDb,
  cleanDb,
  startApp,
  loginAndGetToken,
  readLatestOtp,
  getSharedApp,
  closeSharedApp,
} from './helpers';

// 在测试 DB 上执行任意 SQL（沿用 promote 脚本模式：临时 .cjs + execSync，避免跨进程 DB 连接）
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

// 直接插入一个未激活 SKU（e2e DB 无 seed；绕过 QR 签名，bulkActivate 只查 Sku）
function insertSku(dbFile: string, skuId: string, serial: string) {
  runSql(
    dbFile,
    `INSERT INTO Sku (id, sku, serial, batch, mfgDate, modelName, family, capacity, voltage, chemistry, cycles,
                      warrantyMonthsWhole, warrantyMonthsCell, warrantyMonthsBms, warrantyMonthsParts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    skuId, 'MAT-12V200Ah', serial, 'B202609-E', '2026-09-01T00:00:00Z', 'E2E Battery', 'battery', '200 Ah / 2560 Wh',
    '12.8 V', 'LiFePO4', '≥ 6000 @ 80% DoD', 36, 60, 36, 12,
  );
}

// 登录 → 提权为 dealer（可选带 displayName）→ 重新登录拿新 JWT
async function loginAsDealer(phone: string, displayName?: string): Promise<string> {
  await loginAndGetToken(phone);  // 首次登录建 customer user
  const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
  if (displayName) {
    runSql(dbFile, "UPDATE User SET role='dealer', displayName=? WHERE phone=?", displayName, phone);
  } else {
    runSql(dbFile, "UPDATE User SET role='dealer' WHERE phone=?", phone);
  }
  return loginAndGetToken(phone);  // role 已变更，重新签发 JWT
}

/** T1：提升为 admin 并重签 JWT（与现有 promote 模式一致，抽为 helper 供 Analytics 用例复用） */
async function promoteToAdmin(phone: string): Promise<string> {
  await loginAndGetToken(phone);  // 首登建 user
  const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
  runSql(dbFile, "UPDATE User SET role='admin' WHERE phone=?", phone);
  return loginAndGetToken(phone);  // role 已变更，重新签发 JWT
}

/** v1.1: 提升为 support 并重签 JWT */
async function promoteToSupport(phone: string): Promise<string> {
  await loginAndGetToken(phone);
  const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
  runSql(dbFile, "UPDATE User SET role='support' WHERE phone=?", phone);
  return loginAndGetToken(phone);
}

describe('Matoo Power API (e2e)', () => {
  let dbFile: string;

  beforeEach(() => {
    dbFile = makeTmpDb();
    initDb(dbFile);
  });

  afterEach(async () => {
    await closeSharedApp();
    cleanDb(dbFile);
  });

  // ====================================================
  describe('Auth & RBAC', () => {
    it('GET /admin/sku without JWT → 401', async () => {
      const app = await getSharedApp();
      const r = await app.req.get('/admin/sku');
      expect(r.status).toBe(401);
    });

    it('GET /admin/sku with customer token → 403', async () => {
      const app = await getSharedApp();
      const token = await loginAndGetToken('+8801000000002');
      const r = await app.req.get('/admin/sku').set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(403);
    });
  });

  // ====================================================
  describe('OTP + Login', () => {
    it('request + verify → JWT with customer role', async () => {
      const app = await getSharedApp();
      const r1 = await app.req.post('/auth/otp/request').send({ phone: '+8801000000002' });
      expect(r1.status).toBe(200);
      expect(r1.body.ok).toBe(true);

      // 从 console 输出读 OTP（演示期打印到后端日志；这里直接走 DB 读）
      await new Promise((r) => setTimeout(r, 80));
      const { execSync } = require('child_process');
      const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
      const code = execSync(
        `node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);const r=db.prepare('SELECT code FROM OtpRequest WHERE phone=? AND consumedAt IS NULL ORDER BY createdAt DESC LIMIT 1').get(process.argv[2]);console.log(r?r.code:'')" "${dbFile.replace(/\\/g,'\\\\')}" "+8801000000002"`,
        { encoding: 'utf8' },
      ).trim();
      expect(code).toMatch(/^\d{6}$/);

      const r2 = await app.req.post('/auth/otp/verify').send({ phone: '+8801000000002', code });
      expect(r2.status).toBe(200);
      expect(r2.body.token).toBeDefined();
      expect(r2.body.token.length).toBeGreaterThan(100);
      expect(r2.body.user.role).toBe('customer');
    });

    it('verify wrong code → 400', async () => {
      const app = await getSharedApp();
      await app.req.post('/auth/otp/request').send({ phone: '+8801000000002' });
      const r = await app.req.post('/auth/otp/verify').send({ phone: '+8801000000002', code: '000000' });
      expect(r.status).toBe(400);
    });

    it('P0-1 v1.2 verify → Set-Cookie httpOnly matoo_token；纯 cookie 可认证受保护端点', async () => {
      const app = await getSharedApp();
      await app.req.post('/auth/otp/request').send({ phone: '+8801000000076' });
      await new Promise((r) => setTimeout(r, 80));
      const code = readLatestOtp('+8801000000076');
      expect(code).toMatch(/^\d{6}$/);

      const verify = await app.req.post('/auth/otp/verify').send({ phone: '+8801000000076', code });
      expect(verify.status).toBe(200);

      // ① 断言 Set-Cookie 属性(httpOnly / SameSite=Strict / 7d maxAge)
      const sc = verify.headers['set-cookie'] as unknown as string[] | undefined;
      expect(sc).toBeDefined();
      const cookieHeader = sc!.map((c) => c.split(';')[0]).join('; ');
      expect(sc!.some((c) =>
        c.includes('matoo_token=') &&
        c.includes('HttpOnly') &&
        c.includes('SameSite=Strict'),
      )).toBe(true);

      // ② 纯 cookie 请求（无 Authorization 头）→ 走 jwt.strategy cookie 回退通道
      const me = await app.req.get('/device/mine').set('Cookie', cookieHeader);
      expect(me.status).toBe(200);
      expect(Array.isArray(me.body.items)).toBe(true);
    });

    it('P0-1 v1.2 logout → 清空 Set-Cookie matoo_token', async () => {
      const app = await getSharedApp();
      // 先登录拿 cookie
      await app.req.post('/auth/otp/request').send({ phone: '+8801000000078' });
      await new Promise((r) => setTimeout(r, 80));
      const code = readLatestOtp('+8801000000078');
      const verify = await app.req.post('/auth/otp/verify').send({ phone: '+8801000000078', code });
      expect(verify.status).toBe(200);

      // logout 端点（公开）→ 返回 200 + Set-Cookie 头清 matoo_token
      const out = await app.req.post('/auth/logout');
      expect(out.status).toBe(200);
      expect(out.body?.ok).toBe(true);
      const sc = out.headers['set-cookie'] as unknown as string[] | undefined;
      expect(sc).toBeDefined();
      // cookie 应包含 matoo_token= 与过期时间(past)
      expect(sc!.some((c) => /matoo_token=;/.test(c) || /matoo_token=\b/.test(c) || /matoo_token=;/.test(c))).toBe(true);
    });

    it('P0-9 OTP 失败 5 次 → 账户锁定 429（锁定优先于 code 正确性）', async () => {
      const app = await getSharedApp();
      const phone = '+8801000000077';
      await app.req.post('/auth/otp/request').send({ phone });
      await new Promise((r) => setTimeout(r, 80));
      const code = readLatestOtp(phone);
      expect(code).toMatch(/^\d{6}$/);

      // 5 次错误 → 均 400
      for (let i = 0; i < 5; i++) {
        const r = await app.req.post('/auth/otp/verify').send({ phone, code: '000000' });
        expect(r.status).toBe(400);
      }
      // 第 6 次：即使传入正确 code 也被锁 → 429
      const locked = await app.req.post('/auth/otp/verify').send({ phone, code });
      expect(locked.status).toBe(429);
    });

    it('P0-9 成功验证清零失败计数（4 次失败→成功→再 5 次失败不锁）', async () => {
      const app = await getSharedApp();
      const phone = '+8801000000078';
      await app.req.post('/auth/otp/request').send({ phone });
      await new Promise((r) => setTimeout(r, 80));
      const code = readLatestOtp(phone);
      expect(code).toMatch(/^\d{6}$/);

      // 4 次错误 → 400
      for (let i = 0; i < 4; i++) {
        const r = await app.req.post('/auth/otp/verify').send({ phone, code: '000000' });
        expect(r.status).toBe(400);
      }
      // 成功 → 200（消费 OTP + 清零）
      const ok = await app.req.post('/auth/otp/verify').send({ phone, code });
      expect(ok.status).toBe(200);

      // 清零后：再连错 5 次均 400（若未清零，第 5 次即 429）
      for (let i = 0; i < 5; i++) {
        const r = await app.req.post('/auth/otp/verify').send({ phone, code: '000000' });
        expect(r.status).toBe(400);
      }
      // 再错 1 次 → 429（累积 6 次后锁定）
      const locked = await app.req.post('/auth/otp/verify').send({ phone, code: '000000' });
      expect(locked.status).toBe(429);
    });
  });

  // ====================================================
  describe('SKU', () => {
    it('GET /sku/:id 不存在 → 404', async () => {
      const app = await getSharedApp();
      const r = await app.req.get('/sku/NOT-EXIST-XYZ');
      expect(r.status).toBe(404);
      expect(r.body.error).toBe('NOT_FOUND');
    });
  });

  // ====================================================
  describe('Warranty Activation', () => {
    it('POST /warranty/activate 无 JWT → 401', async () => {
      const app = await getSharedApp();
      const r = await app.req.post('/warranty/activate').send({
        skuId: 'X', serial: 'X', batch: 'X', qrSignature: 'a'.repeat(64),
        country: 'BD', city: 'Dhaka', dealer: 'D', policyAccepted: true,
      });
      expect(r.status).toBe(401);
    });

    it('POST /warranty/activate 字段缺失 → 400', async () => {
      const app = await getSharedApp();
      const token = await loginAndGetToken('+8801000000002');
      const r = await app.req.post('/warranty/activate')
        .set('Authorization', `Bearer ${token}`)
        .send({ skuId: 'X' });
      expect(r.status).toBe(400);
    });
  });

  // ====================================================
  describe('Device', () => {
    it('GET /device/mine 空 → 返回空数组', async () => {
      const app = await getSharedApp();
      const token = await loginAndGetToken('+8801000000002');
      const r = await app.req.get('/device/mine').set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body.items)).toBe(true);
    });

    it('POST /device/:id/diagnostics 不存在的设备 → 404', async () => {
      const app = await getSharedApp();
      const token = await loginAndGetToken('+8801000000002');
      const r = await app.req.post('/device/not-exists/diagnostics').set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(404);
    });
  });

  // ====================================================
  describe('Tickets (CRUD + 权限)', () => {
    it('POST /tickets 创建 → 200', async () => {
      const app = await getSharedApp();
      const token = await loginAndGetToken('+8801000000002');
      const r = await app.req.post('/tickets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'general',
          severity: 'normal',
          subject: 'e2e 测试工单主题',
          description: '这是一个 e2e 测试自动创建的工单描述',
        });
      expect(r.status).toBe(200);
      expect(r.body.ticket.subject).toBe('e2e 测试工单主题');
      expect(r.body.ticket.status).toBe('open');
      expect(r.body.ticket.userId).toBeDefined();
    });

    it('GET /tickets/mine 列出创建的工单', async () => {
      const app = await getSharedApp();
      const token = await loginAndGetToken('+8801000000003');  // 新 phone 隔离
      await app.req.post('/tickets').set('Authorization', `Bearer ${token}`).send({
        type: 'inquiry', severity: 'low', subject: '售前咨询', description: '这是一个售前咨询测试',
      });
      const r = await app.req.get('/tickets/mine').set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(200);
      expect(r.body.items.length).toBeGreaterThanOrEqual(1);
    });

    it('PUT /tickets/:id customer 无权限 → 403', async () => {
      const app = await getSharedApp();
      const token = await loginAndGetToken('+8801000000004');
      const c = await app.req.post('/tickets').set('Authorization', `Bearer ${token}`).send({
        type: 'general', severity: 'normal', subject: '测试工单主题足够长', description: '描述也足够长的内容',
      });
      expect(c.status).toBe(200);
      const tid = c.body.ticket?.id;
      const r = await app.req.put(`/tickets/${tid}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'resolved' });
      expect(r.status).toBe(403);
    });
  });

  // ====================================================
  describe('Dealer & Admin', () => {
    it('customer → /dealer/me → 403', async () => {
      const app = await getSharedApp();
      const token = await loginAndGetToken('+8801000000099');
      const r = await app.req.get('/dealer/me').set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(403);
    });

    it('admin → /admin/overview → 200 with KPIs', async () => {
      const adminPhone = '+8801000000010';
      const app = await getSharedApp();
      // 1) 首次登录（拿到 customer JWT + 触发建 user）
      await loginAndGetToken(adminPhone);
      // 2) 提为 admin
      const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
      const promoteScript = path.join(process.env.TEMP || '/tmp', `promote-${Date.now()}.cjs`);
      fs.writeFileSync(promoteScript, `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(${JSON.stringify(dbFile)});
const r1 = db.prepare("UPDATE User SET role='admin' WHERE phone=?").run(${JSON.stringify(adminPhone)});
process.stdout.write('PROMOTE_RESULT: changes=' + r1.changes + '\\n');
`);
      const out = execSync(`node "${promoteScript}"`, { encoding: 'utf8' });
      fs.unlinkSync(promoteScript);
      process.stderr.write(out);
      const m = out.match(/PROMOTE_RESULT: changes=(\d+)/);
      expect(Number(m![1])).toBe(1);
      // 3) **重新登录** 拿新 JWT（role 已变更）
      const token = await loginAndGetToken(adminPhone);

      const r = await app.req.get('/admin/overview').set('Authorization', `Bearer ${token}`);
      if (r.status !== 200) {
        process.stderr.write(`[admin /overview] status=${r.status} body=${JSON.stringify(r.body)}\n`);
      }
      expect(r.status).toBe(200);
      expect(r.body.overview.sku).toBeDefined();
      expect(typeof r.body.overview.sku.total).toBe('number');
    });

    it('customer → /admin/overview → 403', async () => {
      const app = await getSharedApp();
      const token = await loginAndGetToken('+8801000000011');
      const r = await app.req.get('/admin/overview').set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(403);
    });

    it('dealer bulk-activate → warranty.dealerName = dealer User.displayName（非硬编码）', async () => {
      const app = await getSharedApp();
      const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
      insertSku(dbFile, 'E2E-SKU-001', 'SN-E2E-0001');
      const token = await loginAsDealer('+8801000000088', 'E2E Demo Dealer');

      const r = await app.req.post('/dealer/bulk-activate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ qrId: 'E2E-SKU-001', customerPhone: '+8801000000087', customerName: 'E2E Customer' }],
          shipmentInvoiceNo: 'INV-E2E-001',
        });
      expect(r.status).toBe(200);
      expect(r.body.ok).toBe(true);
      expect(r.body.count).toBe(1);

      const list = await app.req.get('/dealer/warranties').set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body.items.length).toBeGreaterThanOrEqual(1);
      expect(list.body.items[0].dealerName).toBe('E2E Demo Dealer');

      // 同一 SKU 二次激活 → 409（确认 activated 标记生效）
      const dup = await app.req.post('/dealer/bulk-activate')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ qrId: 'E2E-SKU-001', customerPhone: '+8801000000087' }] });
      expect(dup.status).toBe(409);
    });

    it('dealer bulk-activate 无 displayName → dealerName = null（fallback 与普通激活对齐）', async () => {
      const app = await getSharedApp();
      const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
      insertSku(dbFile, 'E2E-SKU-002', 'SN-E2E-0002');
      const token = await loginAsDealer('+8801000000086');

      const r = await app.req.post('/dealer/bulk-activate')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ qrId: 'E2E-SKU-002', customerPhone: '+8801000000085' }] });
      expect(r.status).toBe(200);

      const list = await app.req.get('/dealer/warranties').set('Authorization', `Bearer ${token}`);
      expect(list.body.items[0].dealerName).toBe(null);
    });
  });

  // ====================================================
  describe('T1 Happy Paths & Analytics', () => {
      // 种子 SKU（POST /sku/admin/seed 为公开演示端点，不依赖 runSql 直插）
      async function seedSku(id: string, serial: string) {
        const app = await getSharedApp();
        const r = await app.req.post('/sku/admin/seed').send({
          id,
          sku: 'T1-' + id.replace(/-/g, '').toUpperCase(),
          serial,
          batch: 'T1-BATCH',
          mfgDate: '2026-01-15',
          modelName: 'T1-10K',
          warrantyMonthsWhole: 60,
        });
        expect(r.status).toBe(200);
        return r;
      }
  
      it('SKU happy：seed（公开）→ GET /sku/:id 返回完整结构（含 QR 签名）', async () => {
        const app = await getSharedApp();
        const seed = await seedSku('t1-sku-1', 'T1-SERIAL-001');
        expect(seed.body.id).toBe('t1-sku-1');  // SkuEntity 展开在根层（{ ok, id, sku, ..., qr }）
        expect(seed.body.qr.signature).toMatch(/^[0-9a-f]{64}$/);

        const r = await app.req.get('/sku/t1-sku-1');
        expect(r.status).toBe(200);
        expect(r.body.ok).toBe(true);
        expect(r.body.modelName).toBe('T1-10K');
        expect(r.body.qr.qrId).toBeDefined();
      });
  
      it('Warranty happy：activate（无发票 → 策略 MFG_FALLBACK）→ mine → by-sku 全链路', async () => {
        const app = await getSharedApp();
        await seedSku('t1-sku-2', 'T1-SERIAL-002');
        const token = await loginAsDealer('+8801000000081', 'T1 Dealer');
  
        const act = await app.req.post('/warranty/activate')
          .set('Authorization', `Bearer ${token}`)
          .send({ skuId: 't1-sku-2', country: 'BD', city: 'Dhaka', dealerName: 'T1 Dealer' });
        expect(act.status).toBe(200);
        expect(act.body.policy).toBe('MFG_FALLBACK');  // resolveStartAt：无发票必走 MFG 兜底
        expect(act.body.warranty.status).toBe('active');
        expect(new Date(act.body.endAtWhole).getTime()).toBeGreaterThan(Date.now()); // 60 个月后
        expect(act.body.warranty.dealerName).toBe('T1 Dealer');  // §6.3 displayName 通道
  
        const mine = await app.req.get('/warranty/mine').set('Authorization', `Bearer ${token}`);
        expect(mine.status).toBe(200);
        expect(mine.body.items.length).toBe(1);
        expect(mine.body.items[0].skuId).toBe('t1-sku-2');
  
        const bySku = await app.req.get('/warranty/by-sku/t1-sku-2').set('Authorization', `Bearer ${token}`);
        expect(bySku.status).toBe(200);
        expect(bySku.body.warranty).not.toBeNull();
        expect(bySku.body.warranty.status).toBe('active');
      });
  
      it('Device happy：bind → mine 含绑定设备', async () => {
        const app = await getSharedApp();
        await seedSku('t1-sku-3', 'T1-SERIAL-003');
        const token = await loginAsDealer('+8801000000082');
  
        const b = await app.req.post('/device/bind')
          .set('Authorization', `Bearer ${token}`)
          .send({ skuId: 't1-sku-3' });
        expect(b.status).toBe(200);
        expect(b.body.device.skuId).toBe('t1-sku-3');
        const deviceId = b.body.device.id;
  
        const mine = await app.req.get('/device/mine').set('Authorization', `Bearer ${token}`);
        expect(mine.status).toBe(200);
        expect(mine.body.items.some((d: any) => d.id === deviceId)).toBe(true);
      });
  
      it('Analytics trends shape（admin）：days 参数 + 三系列当日补齐 + 数据联动', async () => {
        const app = await getSharedApp();
        const token = await promoteToAdmin('+8801000000083');
  
        // 造一条 today 数据：确保 warranty 系列当日 ≥1
        await seedSku('t1-sku-4', 'T1-SERIAL-004');
        const dealer = await loginAsDealer('+8801000000084');
        await app.req.post('/warranty/activate')
          .set('Authorization', `Bearer ${dealer}`)
          .send({ skuId: 't1-sku-4', country: 'BD', city: 'Dhaka' });
  
        const r = await app.req.get('/admin/analytics/trends?days=7').set('Authorization', `Bearer ${token}`);
        expect(r.status).toBe(200);
        expect(r.body.days).toBe(7);
        for (const series of ['warranty', 'device', 'ticket'] as const) {
          expect(Array.isArray(r.body[series])).toBe(true);
          expect(r.body[series].length).toBe(7);  // fillDays 补齐全 7 天
          for (const pt of r.body[series]) {
            expect(pt.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);  // YYYY-MM-DD
            expect(typeof pt.c).toBe('number');
          }
        }
        // 数组按旧→新，末位 = 今天；已激活 1 条保修
        expect(r.body.warranty[6].c).toBeGreaterThanOrEqual(1);
      });
  
      it('Analytics breakdown shape（admin）：warranty 按 sku 分组 → { key, c }', async () => {
        const app = await getSharedApp();
        const token = await promoteToAdmin('+8801000000085');
  
        const r = await app.req.get('/admin/analytics/breakdown?type=warranty&groupBy=sku')
          .set('Authorization', `Bearer ${token}`);
        expect(r.status).toBe(200);
        expect(Array.isArray(r.body.items)).toBe(true);
        for (const item of r.body.items) {
          expect(typeof item.key).toBe('string');
          expect(typeof item.c).toBe('number');
        }
      });
    });
  
    describe('Swagger / OpenAPI', () => {
      it('GET /api-json → 200 with valid spec', async () => {
        const app = await getSharedApp();
        const r = await app.req.get('/api-json');
        expect(r.status).toBe(200);
        expect(r.body.openapi).toMatch(/^3\./);
        expect(r.body.info.title).toContain('Matoo');
        expect(r.body.paths['/auth/otp/request']).toBeDefined();
        expect(r.body.paths['/admin/overview']).toBeDefined();
        expect(r.body.paths['/tickets']).toBeDefined();
      });
    });

    // ============================================================
    // v1.1: support 角色 / 审计 / CSV
    // ============================================================
    describe('v1.1 Support Role', () => {
      it('support → /admin/tickets → 200 (含 stats + list)', async () => {
        const app = await getSharedApp();
        const token = await promoteToSupport('+8801000000200');

        const t = await app.req.get('/admin/tickets').set('Authorization', `Bearer ${token}`);
        expect(t.status).toBe(200);
        expect(Array.isArray(t.body.items)).toBe(true);

        const s = await app.req.get('/admin/tickets/stats').set('Authorization', `Bearer ${token}`);
        expect(s.status).toBe(200);
        expect(s.body.stats).toBeDefined();
        expect(typeof s.body.stats.open).toBe('number');
      });

      it('support → /admin/users → 403(只 admin 可看用户列表)', async () => {
        const app = await getSharedApp();
        const token = await promoteToSupport('+8801000000201');
        const r = await app.req.get('/admin/users').set('Authorization', `Bearer ${token}`);
        expect(r.status).toBe(403);
      });

      it('support → /admin/sku → 403(只 admin 可看 SKU 列表)', async () => {
        const app = await getSharedApp();
        const token = await promoteToSupport('+8801000000202');
        const r = await app.req.get('/admin/sku').set('Authorization', `Bearer ${token}`);
        expect(r.status).toBe(403);
      });

      it('support → PUT /tickets/:id 改状态 → 200 + 写 TicketStatusLog', async () => {
        const app = await getSharedApp();
        // 1) customer 建工单
        const customerToken = await loginAndGetToken('+8801000000203');
        const c = await app.req.post('/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ type: 'general', severity: 'high', subject: 'support-改状态测试', description: '详情字数足够长' });
        expect(c.status).toBe(200);
        const tid = c.body.ticket.id;

        // 2) support 改状态
        const supportToken = await promoteToSupport('+8801000000204');
        const u = await app.req.put(`/tickets/${tid}`)
          .set('Authorization', `Bearer ${supportToken}`)
          .send({ status: 'in_progress', resolution: 'support 处理中' });
        expect(u.status).toBe(200);
        expect(u.body.ticket.status).toBe('in_progress');

        // 3) 验证 TicketStatusLog 写入
        const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
        const logCount = Number(execSync(
          `node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);const r=db.prepare(\\"SELECT COUNT(*) AS c FROM TicketStatusLog WHERE ticketId=? AND fromStatus='open' AND toStatus='in_progress'\\").get(process.argv[2]);console.log(r.c)" "${dbFile.replace(/\\/g,'\\\\')}" "${tid}"`,
          { encoding: 'utf8' },
        ).trim());
        expect(logCount).toBe(1);
      });

      it('customer → /admin/tickets → 403(回归)', async () => {
        const app = await getSharedApp();
        const token = await loginAndGetToken('+8801000000205');
        const r = await app.req.get('/admin/tickets').set('Authorization', `Bearer ${token}`);
        expect(r.status).toBe(403);
      });
    });

    describe('v1.1 Audit Log (Warranty Review + Ticket Update)', () => {
      it('admin review warranty → 写 WarrantyReviewLog + AuditLog', async () => {
        const app = await getSharedApp();
        const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
        insertSku(dbFile, 'audit-sku-1', 'SN-AUDIT-0001');

        // dealer 激活保修(从 pending 起步演示审核)
        const dealerToken = await loginAsDealer('+8801000000210', 'Audit Dealer');
        const act = await app.req.post('/warranty/activate')
          .set('Authorization', `Bearer ${dealerToken}`)
          .send({ skuId: 'audit-sku-1', country: 'BD', city: 'Dhaka', dealerName: 'Audit Dealer' });
        expect(act.status).toBe(200);
        const wid = act.body.warranty.id;

        // admin review → rejected
        const adminToken = await promoteToAdmin('+8801000000211');
        const rev = await app.req.post(`/admin/warranties/${wid}/review`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'rejected', notes: 'e2e 审计测试驳回' });
        expect(rev.status).toBe(200);
        expect(rev.body.warranty.status).toBe('rejected');

        // 验证 WarrantyReviewLog
        const wrl = Number(execSync(
          `node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);const r=db.prepare(\\"SELECT COUNT(*) AS c FROM WarrantyReviewLog WHERE warrantyId=? AND toStatus='rejected'\\").get(process.argv[2]);console.log(r.c)" "${dbFile.replace(/\\/g,'\\\\')}" "${wid}"`,
          { encoding: 'utf8' },
        ).trim());
        expect(wrl).toBe(1);

        // 验证 AuditLog(中间件捕获)
        const audit = Number(execSync(
          `node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);const r=db.prepare(\\"SELECT COUNT(*) AS c FROM AuditLog WHERE action LIKE '%review%' AND actorRole='admin'\\").get();console.log(r.c)" "${dbFile.replace(/\\/g,'\\\\')}"`,
          { encoding: 'utf8' },
        ).trim());
        expect(audit).toBeGreaterThanOrEqual(1);
      });
    });

    describe('v1.1 CSV Export', () => {
      async function seedSkuForCsv(id: string, serial: string) {
        const app = await getSharedApp();
        const r = await app.req.post('/sku/admin/seed').send({
          id, sku: 'CSV-' + id.replace(/-/g, '').toUpperCase(), serial, batch: 'CSV-BATCH',
          mfgDate: '2026-01-01', modelName: 'CSV-MODEL', warrantyMonthsWhole: 36,
        });
        expect(r.status).toBe(200);
      }

      it('GET /admin/sku.csv → text/csv + BOM + Content-Disposition', async () => {
        await seedSkuForCsv('csv-sku-1', 'CSV-SN-0001');
        const app = await getSharedApp();
        const adminToken = await promoteToAdmin('+8801000000300');
        const r = await app.req.get('/admin/sku.csv').set('Authorization', `Bearer ${adminToken}`);
        expect(r.status).toBe(200);
        expect(r.headers['content-type']).toMatch(/text\/csv/);
        expect(r.headers['content-disposition']).toMatch(/attachment.*\.csv/);
        const text = r.text;
        // BOM + 表头
        expect(text.charCodeAt(0)).toBe(0xfeff);
        // 单独取 header 行(去掉 BOM 后按 \r\n 切第一行)
        const headerLine = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split(/\r?\n/)[0] ?? '';
        expect(headerLine).toContain('sku');
        expect(headerLine).toContain('modelName');
        expect(text).toContain('csv-sku-1');
      });

      it('GET /admin/warranties.csv → CSV with warranty rows', async () => {
        const app = await getSharedApp();
        const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
        insertSku(dbFile, 'csv-sku-2', 'CSV-SN-0002');
        const dealerToken = await loginAsDealer('+8801000000301', 'CSV Dealer');
        const act = await app.req.post('/warranty/activate')
          .set('Authorization', `Bearer ${dealerToken}`)
          .send({ skuId: 'csv-sku-2', country: 'BD', city: 'Dhaka' });
        expect(act.status).toBe(200);

        const adminToken = await promoteToAdmin('+8801000000302');
        const r = await app.req.get('/admin/warranties.csv').set('Authorization', `Bearer ${adminToken}`);
        expect(r.status).toBe(200);
        expect(r.headers['content-type']).toMatch(/text\/csv/);
        expect(r.text).toContain('csv-sku-2');
      });

      it('GET /admin/users.csv → CSV + admin 权限隔离', async () => {
        const app = await getSharedApp();
        const customerToken = await loginAndGetToken('+8801000000303');
        // customer → 403
        const r403 = await app.req.get('/admin/users.csv').set('Authorization', `Bearer ${customerToken}`);
        expect(r403.status).toBe(403);
        // admin → 200
        const adminToken = await promoteToAdmin('+8801000000304');
        const r = await app.req.get('/admin/users.csv').set('Authorization', `Bearer ${adminToken}`);
        expect(r.status).toBe(200);
        expect(r.headers['content-type']).toMatch(/text\/csv/);
        expect(r.text).toContain('phone');
      });

      it('GET /admin/tickets.csv → support 可访问', async () => {
        const app = await getSharedApp();
        const supportToken = await promoteToSupport('+8801000000305');
        const r = await app.req.get('/admin/tickets.csv').set('Authorization', `Bearer ${supportToken}`);
        expect(r.status).toBe(200);
        expect(r.headers['content-type']).toMatch(/text\/csv/);
      });

      it('GET /dealer/warranties.csv + /dealer/devices.csv → dealer 可用', async () => {
        const app = await getSharedApp();
        const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
        insertSku(dbFile, 'csv-sku-3', 'CSV-SN-0003');
        const dealerToken = await loginAsDealer('+8801000000306', 'CSV Dealer 3');
        await app.req.post('/warranty/activate')
          .set('Authorization', `Bearer ${dealerToken}`)
          .send({ skuId: 'csv-sku-3', country: 'BD', city: 'Dhaka' });

        const w = await app.req.get('/dealer/warranties.csv').set('Authorization', `Bearer ${dealerToken}`);
        expect(w.status).toBe(200);
        expect(w.headers['content-type']).toMatch(/text\/csv/);
        expect(w.text).toContain('csv-sku-3');

        const d = await app.req.get('/dealer/devices.csv').set('Authorization', `Bearer ${dealerToken}`);
        expect(d.status).toBe(200);
        expect(d.headers['content-type']).toMatch(/text\/csv/);
      });
    });

    // ============================================================
    // P0-4 v1.2: /admin/audit 端点暴露
    // ============================================================
    describe('P0-4 /admin/audit (审计查询端点)', () => {
      it('GET /admin/audit?limit=20 → admin 返回 items 数组', async () => {
        const app = await getSharedApp();
        const adminToken = await promoteToAdmin('+8801000000400');
        const r = await app.req.get('/admin/audit?limit=20').set('Authorization', `Bearer ${adminToken}`);
        expect(r.status).toBe(200);
        expect(r.body.ok).toBe(true);
        expect(Array.isArray(r.body.items)).toBe(true);
      });

      it('GET /admin/audit → 401 未授权 + customer/dealer 403', async () => {
        const app = await getSharedApp();
        const r1 = await app.req.get('/admin/audit');
        expect(r1.status).toBe(401);
        const customerToken = await loginAndGetToken('+8801000000401');
        const r2 = await app.req.get('/admin/audit').set('Authorization', `Bearer ${customerToken}`);
        expect(r2.status).toBe(403);
        const dealerToken = await loginAsDealer('+8801000000402', 'Audit Dealer');
        const r3 = await app.req.get('/admin/audit').set('Authorization', `Bearer ${dealerToken}`);
        expect(r3.status).toBe(403);
      });

      it('GET /admin/audit/warranty/:id → 返回双路审计(AuditLog + WarrantyReviewLog)', async () => {
        const app = await getSharedApp();
        const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
        insertSku(dbFile, 'audit-trail-1', 'SN-TRAIL-0001');

        const dealerToken = await loginAsDealer('+8801000000403', 'Trail Dealer');
        const act = await app.req.post('/warranty/activate')
          .set('Authorization', `Bearer ${dealerToken}`)
          .send({ skuId: 'audit-trail-1', country: 'BD', city: 'Dhaka' });
        expect(act.status).toBe(200);
        const wid = act.body.warranty.id;

        // 用 rejected 保证 fromStatus !== status,确保 WarrantyReviewLog 写入
        const adminToken = await promoteToAdmin('+8801000000404');
        await app.req.post(`/admin/warranties/${wid}/review`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'rejected', notes: 'P0-4 审计测试' });

        const r = await app.req.get(`/admin/audit/warranty/${wid}`).set('Authorization', `Bearer ${adminToken}`);
        expect(r.status).toBe(200);
        expect(r.body.ok).toBe(true);
        expect(Array.isArray(r.body.audit)).toBe(true);
        expect(Array.isArray(r.body.reviewLogs)).toBe(true);
        expect(r.body.reviewLogs.length).toBeGreaterThanOrEqual(1);
      });
    });

    // ============================================================
    // P0-6 v1.2: bulk-review 批量审核端点
    // ============================================================
    describe('P0-6 /admin/warranties/bulk-review (批量审核)', () => {
      it('POST /admin/warranties/bulk-review → admin 一次审核多条(部分可 active)', async () => {
        const app = await getSharedApp();
        const dbFile = process.env.DATABASE_URL!.replace(/^file:/, '');
        // 准备 3 个保修
        for (let i = 0; i < 3; i++) {
          insertSku(dbFile, `bulk-sku-${i}`, `SN-BULK-${i}`);
          const dealerToken = await loginAsDealer(`+880100000050${i}`, `Bulk Dealer ${i}`);
          await app.req.post('/warranty/activate')
            .set('Authorization', `Bearer ${dealerToken}`)
            .send({ skuId: `bulk-sku-${i}`, country: 'BD', city: 'Dhaka' });
        }

        // 取任意 warranty ids(测试不限定状态;批量把 active → rejected 等)
        const anyIds = execSync(
          `node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);const r=db.prepare(\\"SELECT id FROM Warranty WHERE id LIKE 'warranty%' LIMIT 3\\").all();console.log(r.map(x=>x.id).join(','))" "${dbFile.replace(/\\/g,'\\\\')}"`,
          { encoding: 'utf8' },
        ).trim().split(',').filter(Boolean);
        if (anyIds.length === 0) return; // 测试阶段未生成保修时跳过

        const adminToken = await promoteToAdmin('+8801000000510');
        const r = await app.req.post('/admin/warranties/bulk-review')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ ids: anyIds, status: 'active', notes: 'P0-6 批量测试' });
        expect(r.status).toBe(200);
        expect(r.body.ok).toBe(true);
        expect(r.body.total).toBe(anyIds.length);
        expect(Array.isArray(r.body.succeeded)).toBe(true);
        expect(Array.isArray(r.body.failed)).toBe(true);
      });

      it('POST /admin/warranties/bulk-review → 401/403/400', async () => {
        const app = await getSharedApp();
        // 未授权
        const r1 = await app.req.post('/admin/warranties/bulk-review').send({ ids: ['x'], status: 'active' });
        expect(r1.status).toBe(401);
        // customer 403
        const customerToken = await loginAndGetToken('+8801000000511');
        const r2 = await app.req.post('/admin/warranties/bulk-review')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ids: ['x'], status: 'active' });
        expect(r2.status).toBe(403);
        // 空 ids → 400
        const adminToken = await promoteToAdmin('+8801000000512');
        const r3 = await app.req.post('/admin/warranties/bulk-review')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ ids: [], status: 'active' });
        expect(r3.status).toBe(400);
      });
    });
});
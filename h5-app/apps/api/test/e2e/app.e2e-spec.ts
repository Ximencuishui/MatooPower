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
  getSharedApp,
  closeSharedApp,
} from './helpers';

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
  });

  // ====================================================
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
});
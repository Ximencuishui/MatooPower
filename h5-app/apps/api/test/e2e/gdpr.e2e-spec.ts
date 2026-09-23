// P1-1 v1.4:GDPR 软删 E2E 测试
// - 覆盖：自删拒绝 / 删 admin / 末位 admin 拒绝 / 已删不显示 / Session 已清 / AuditLog 写 / 幂等
// - 使用 mintAdminToken 绕过 OTP

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
  return path.join(os.tmpdir(), `matoo-gdpr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`);
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

/** 直接 INSERT User 行(已知 phone/role)并返回 id */
function insertUserRaw(dbFile: string, phone: string, role: 'admin' | 'customer' | 'dealer'): string {
  const id = `usr_${role}_${Math.random().toString(36).slice(2, 10)}`;
  const script = path.join(os.tmpdir(), `gdpr-ins-${Date.now()}.cjs`);
  fs.writeFileSync(script, `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(${JSON.stringify(dbFile)});
db.prepare("INSERT INTO User (id, phone, role, displayName) VALUES (?, ?, ?, ?)").run(${JSON.stringify(id)}, ${JSON.stringify(phone)}, ${JSON.stringify(role)}, ${JSON.stringify('Demo ' + role)});
console.log(${JSON.stringify(id)});
`);
  try {
    return execSync(`node "${script}"`, { encoding: 'utf8' }).trim();
  } finally {
    try { fs.unlinkSync(script); } catch {}
  }
}

/** 直接 SQL 读 deletedAt/anonymizedPhone/Session 计数等 */
function dbGet(dbFile: string, sql: string): any {
  const script = path.join(os.tmpdir(), `gdpr-get-${Date.now()}.cjs`);
  fs.writeFileSync(script, `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(${JSON.stringify(dbFile)});
const r = db.prepare(${JSON.stringify(sql)}).get();
console.log(JSON.stringify(r ?? null));
`);
  try {
    return JSON.parse(execSync(`node "${script}"`, { encoding: 'utf8' }).trim() || 'null');
  } finally {
    try { fs.unlinkSync(script); } catch {}
  }
}
function dbAll(dbFile: string, sql: string): any[] {
  const script = path.join(os.tmpdir(), `gdpr-all-${Date.now()}.cjs`);
  fs.writeFileSync(script, `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(${JSON.stringify(dbFile)});
const r = db.prepare(${JSON.stringify(sql)}).all();
console.log(JSON.stringify(r));
`);
  try {
    return JSON.parse(execSync(`node "${script}"`, { encoding: 'utf8' }).trim() || '[]');
  } finally {
    try { fs.unlinkSync(script); } catch {}
  }
}

describe('P1-1 GDPR DELETE /admin/users/:id (e2e)', () => {
  let dbFile: string;
  let app: INestApplication;
  let req: ReturnType<typeof request>;
  let jwt: JwtService;
  let adminToken: string;
  let adminId: string;
  let otherAdminId: string;

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

    // 创建两个 admin(测末位 admin 检查)
    adminId = insertUserRaw(dbFile, '+8801000000100', 'admin');
    otherAdminId = insertUserRaw(dbFile, '+8801000000101', 'admin');
    adminToken = await jwt.signAsync({ sub: adminId, role: 'admin', phone: '+8801000000100' }, { expiresIn: '7d' });
  });

  afterAll(async () => {
    if (app) await app.close();
    cleanDb(dbFile);
  });

  it('① 不能删自己 → 409', async () => {
    const r = await req.delete(`/admin/users/${adminId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/不能删除当前登录账号/);
  });

  it('② 正常删除 admin 用户 → 200,phone/email 置 NULL,deletedAt 落表', async () => {
    const before = dbGet(dbFile, `SELECT id, phone, role, deletedAt FROM User WHERE id='${otherAdminId}'`);
    expect(before.role).toBe('admin');
    expect(before.deletedAt).toBeNull();

    const r = await req.delete(`/admin/users/${otherAdminId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.id).toBe(otherAdminId);
    expect(r.body.deletedAt).toBeTruthy();
    expect(r.body.anonymizedPhone).toMatch(/^[a-f0-9]{64}$/);

    const after = dbGet(dbFile, `SELECT id, phone, email, passwordHash, displayName, role, deletedAt, anonymizedPhone FROM User WHERE id='${otherAdminId}'`);
    expect(after.phone).toBeNull();
    expect(after.email).toBeNull();
    expect(after.passwordHash).toBeNull();
    expect(after.displayName).toBeNull();
    expect(after.role).toBe('anonymous');
    expect(after.deletedAt).not.toBeNull();
  });

  it('③ 已删用户从 listUsers 消失', async () => {
    const r = await req.get('/admin/users?pageSize=100').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    const ids = (r.body.items ?? []).map((u: any) => u.id);
    expect(ids).not.toContain(otherAdminId);
  });

  it('④ Session 已清', async () => {
    const r = dbGet(dbFile, `SELECT COUNT(*) AS c FROM Session WHERE userId='${otherAdminId}'`);
    expect(Number(r.c)).toBe(0);
  });

  it('⑤ AuditLog 写一行 user.gdpr_delete', async () => {
    const rows = dbAll(
      dbFile,
      `SELECT actorUserId, action, resource FROM AuditLog WHERE action='user.gdpr_delete' AND resource='user:${otherAdminId}'`,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].actorUserId).toBe(adminId);
  });

  it('⑥ 已删用户不能再删(幂等) → 409', async () => {
    const r = await req.delete(`/admin/users/${otherAdminId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(409);
  });

  it('⑦ 末位 admin 拒绝删除', async () => {
    // 此时除 adminId 外的所有 admin 都已被删,只剩 1 个
    const r = await req.delete(`/admin/users/${adminId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/最后一个管理员/);
  });

  it('⑧ customer 用户可被 admin 删除', async () => {
    const customerId = insertUserRaw(dbFile, '+8801000000200', 'customer');
    const r = await req.delete(`/admin/users/${customerId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);

    const after = dbGet(dbFile, `SELECT phone, email, role, deletedAt FROM User WHERE id='${customerId}'`);
    expect(after.phone).toBeNull();
    expect(after.email).toBeNull();
    expect(after.role).toBe('anonymous');
    expect(after.deletedAt).not.toBeNull();
  });
});
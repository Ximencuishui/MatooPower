// P1-3 v1.4 SLA 自动升级 sweep + stats e2e 测试
// 直接在 DB 里造「2h 前的 normal 工单」「4h 前的 high 工单」「已 resolved 的工单」,然后调 sweep 端点验证升级 + stats 计数

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { makeTmpDb, initDb, cleanDb, startApp, AppHandle, mintAdminToken } from './helpers';

describe('P1-3 SLA Auto-escalation (e2e)', () => {
  let app: AppHandle;
  let dbFile: string;
  let adminToken: string;

  beforeAll(async () => {
    dbFile = makeTmpDb();
    initDb(dbFile);
    app = await startApp();
    adminToken = await mintAdminToken(app);
  });

  afterAll(async () => {
    await app.close();
    cleanDb(dbFile);
  });

  // 写临时 cjs 脚本,用 child_process 跑(DBA 同进程互斥用)
  function runDbScript(scriptBody: string): string {
    const script = path.join(process.env.TEMP || '/tmp', `sla-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.cjs`);
    const code = `const { DatabaseSync } = require('node:sqlite');\nconst db = new DatabaseSync(${JSON.stringify(dbFile)});\n${scriptBody}\n`;
    fs.writeFileSync(script, code);
    try {
      return execSync(`node "${script}"`, { encoding: 'utf8', stdio: 'pipe' });
    } finally {
      try { fs.unlinkSync(script); } catch {}
    }
  }

  function execDb<T = any>(scriptBody: string): T {
    const out = runDbScript(scriptBody);
    const trimmed = out.trim();
    if (!trimmed) return undefined as unknown as T;
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed as unknown as T;
    }
  }

  function isoMinusMin(min: number): string {
    return new Date(Date.now() - min * 60_000).toISOString();
  }

  function seedTicket(opts: {
    id?: string;
    severity: 'normal' | 'high' | 'urgent' | 'low';
    status?: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
    createdAt: string;
    userId?: string;
  }): string {
    const id = opts.id ?? `ticket-sla-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const userId = opts.userId ?? `usr-sla-${Math.floor(Math.random() * 100000)}`;
    const status = opts.status ?? 'open';
    const phone = '+880' + Math.floor(Math.random() * 1e10);
    execDb(
      `db.prepare("INSERT OR REPLACE INTO User (id, phone, role, createdAt) VALUES (?, ?, 'customer', CURRENT_TIMESTAMP)").run(${JSON.stringify(userId)}, ${JSON.stringify(phone)});` +
      `db.prepare("INSERT OR REPLACE INTO Ticket (id, userId, type, severity, subject, description, status, createdAt, updatedAt) VALUES (?, ?, 'general', ?, ?, ?, ?, ?, ?)").run(${JSON.stringify(id)}, ${JSON.stringify(userId)}, ${JSON.stringify(opts.severity)}, 'SLA test', 'desc', ${JSON.stringify(status)}, ${JSON.stringify(opts.createdAt)}, ${JSON.stringify(opts.createdAt)});`,
    );
    return id;
  }

  function getTicketSeverity(id: string): string {
    const row = execDb<{ severity: string }>(
      `console.log(JSON.stringify(db.prepare("SELECT severity FROM Ticket WHERE id=?").get(${JSON.stringify(id)})));`,
    );
    return row?.severity ?? '';
  }

  function getLatestStatusLog(ticketId: string): { actorUserId: string; resolution: string } | null {
    return execDb<{ actorUserId: string; resolution: string }>(
      `const r=db.prepare("SELECT actorUserId, resolution FROM TicketStatusLog WHERE ticketId=? ORDER BY createdAt DESC LIMIT 1").get(${JSON.stringify(ticketId)}); console.log(JSON.stringify(r));`,
    );
  }

  function getLatestSystemMsg(ticketId: string): { senderRole: string; body: string } | null {
    return execDb<{ senderRole: string; body: string }>(
      `const r=db.prepare("SELECT senderRole, body FROM TicketMessage WHERE ticketId=? AND senderRole='system' ORDER BY createdAt DESC LIMIT 1").get(${JSON.stringify(ticketId)}); console.log(JSON.stringify(r));`,
    );
  }

  function addSupportMsg(ticketId: string) {
    execDb(
      `db.prepare("INSERT OR REPLACE INTO User (id, phone, role, createdAt) VALUES (?, ?, 'support', CURRENT_TIMESTAMP)").run('usr-support-1', '+8801000000099');` +
      `db.prepare("INSERT INTO TicketMessage (id, ticketId, senderUserId, senderRole, body, createdAt) VALUES (?, ?, ?, 'support', ?, CURRENT_TIMESTAMP)").run(${JSON.stringify(`tm-${ticketId}-1`)}, ${JSON.stringify(ticketId)}, 'usr-support-1', 'support replied');`,
    );
  }

  it('GET /admin/tickets/sla-stats → 200 + 结构正确', async () => {
    const r = await app.req.get('/admin/tickets/sla-stats').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(typeof r.body.openOver2h).toBe('number');
    expect(typeof r.body.highOver4h).toBe('number');
  });

  it('GET /admin/tickets/sla-stats 未登录 → 401', async () => {
    const r = await app.req.get('/admin/tickets/sla-stats');
    expect(r.status).toBe(401);
  });

  it('POST /admin/tickets/sla-sweep 手动触发 → 200 + 返回 details', async () => {
    const r = await app.req.post('/admin/tickets/sla-sweep').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(typeof r.body.upgraded).toBe('number');
    expect(Array.isArray(r.body.details)).toBe(true);
  });

  it('normal 工单 2h 前创建 + 无客服消息 → sweep 后升 high', async () => {
    const tid = seedTicket({ severity: 'normal', createdAt: isoMinusMin(130) });
    const r = await app.req.post('/admin/tickets/sla-sweep').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    const upgraded = r.body.details.find((d: any) => d.id === tid);
    expect(upgraded).toBeDefined();
    expect(upgraded.fromSeverity).toBe('normal');
    expect(upgraded.toSeverity).toBe('high');
    expect(getTicketSeverity(tid)).toBe('high');
  });

  it('high 工单 4h 前创建 + 未解决 → sweep 后升 urgent', async () => {
    const tid = seedTicket({ severity: 'high', createdAt: isoMinusMin(260) });
    const r = await app.req.post('/admin/tickets/sla-sweep').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    const upgraded = r.body.details.find((d: any) => d.id === tid);
    expect(upgraded).toBeDefined();
    expect(upgraded.fromSeverity).toBe('high');
    expect(upgraded.toSeverity).toBe('urgent');
    expect(getTicketSeverity(tid)).toBe('urgent');
  });

  it('已 resolved 工单 sweep 后不升级', async () => {
    const tid = seedTicket({ severity: 'normal', status: 'resolved', createdAt: isoMinusMin(180) });
    const r = await app.req.post('/admin/tickets/sla-sweep').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    const upgraded = r.body.details.find((d: any) => d.id === tid);
    expect(upgraded).toBeUndefined();
    expect(getTicketSeverity(tid)).toBe('normal');
  });

  it('normal 工单 2h 前创建 + 已有客服消息 → sweep 后不升级', async () => {
    const tid = seedTicket({ severity: 'normal', createdAt: isoMinusMin(130) });
    addSupportMsg(tid);
    const r = await app.req.post('/admin/tickets/sla-sweep').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    const upgraded = r.body.details.find((d: any) => d.id === tid);
    expect(upgraded).toBeUndefined();
  });

  it('sweep 升级时写入 TicketStatusLog(actorUserId=system-sla) + TicketMessage(system)', async () => {
    const tid = seedTicket({ severity: 'normal', createdAt: isoMinusMin(200) });
    await app.req.post('/admin/tickets/sla-sweep').set('Authorization', `Bearer ${adminToken}`);
    const log = getLatestStatusLog(tid);
    expect(log?.actorUserId).toBe('system-sla');
    expect(log?.resolution).toBe('Auto SLA escalation');
    const msg = getLatestSystemMsg(tid);
    expect(msg?.senderRole).toBe('system');
    expect(msg?.body).toContain('Auto SLA escalation');
  });

  it('sla-stats 正确计数(数字类型 + 不抛错)', async () => {
    const r = await app.req.get('/admin/tickets/sla-stats').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(typeof r.body.openOver2h).toBe('number');
    expect(typeof r.body.highOver4h).toBe('number');
  });
});

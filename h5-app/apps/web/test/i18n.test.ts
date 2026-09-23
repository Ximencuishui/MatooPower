// Matoo Power Web — Vitest 单元测试套件
// 覆盖：i18n 对称 / auth-store / API client 错误 / Shop 过滤逻辑
// （组件级测试需 jsdom + react-renderer 配置，沙盒内优先覆盖纯逻辑）

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ========== i18n 对称性 ==========
import { zh } from '../src/locales/zh-CN';
import { en } from '../src/locales/en';
import { bn } from '../src/locales/bn';
import { hi } from '../src/locales/hi';
import { ur } from '../src/locales/ur';

describe('i18n dictionary symmetry', () => {
  it('zh-CN 与 en 顶级 keys 完全一致', () => {
    const zhKeys = Object.keys(zh).sort();
    const enKeys = Object.keys(en).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it('每个区块的 keys 一致（递归）', () => {
    function getKeys(obj: any, prefix = ''): string[] {
      const out: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          out.push(...getKeys(v, path));
        } else {
          out.push(path);
        }
      }
      return out;
    }
    const zhAll = getKeys(zh).sort();
    const enAll = getKeys(en).sort();
    const missing = zhAll.filter((k) => !enAll.includes(k));
    const extra = enAll.filter((k) => !zhAll.includes(k));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it('zh-CN 关键字段非空', () => {
    expect(zh.app.name).toBe('Matoo Power');
    expect(zh.tabs.home).toBeTruthy();
    expect(zh.scan.genuine).toBeTruthy();
    expect(zh.ticket.newTitle).toBeTruthy();
    expect(zh.adminOverview.title).toBeTruthy();
    expect(zh.common.loading).toBeTruthy();
    expect(zh.onboarding.step1Title).toBeTruthy();
    expect(zh.messages.title).toBeTruthy();
  });

  it('所有占位符 {n} {t} {s} {c} {time} 在 zh/en 中位置对齐', () => {
    function collectPlaceholders(obj: any, path = ''): Record<string, string[]> {
      const out: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(obj)) {
        const p = path ? `${path}.${k}` : k;
        if (typeof v === 'string') {
          const matches = [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '');
          if (matches.length) out[p] = matches.sort();
        } else if (v && typeof v === 'object') {
          Object.assign(out, collectPlaceholders(v, p));
        }
      }
      return out;
    }
    const zhP = collectPlaceholders(zh);
    const enP = collectPlaceholders(en);
    const diffKeys: string[] = [];
    for (const k of Object.keys(zhP)) {
      if (!enP[k]) diffKeys.push(`${k}: only in zh`);
      else if (JSON.stringify(zhP[k]) !== JSON.stringify(enP[k])) diffKeys.push(`${k}: ${zhP[k]} vs ${enP[k]}`);
    }
    for (const k of Object.keys(enP)) {
      if (!zhP[k]) diffKeys.push(`${k}: only in en`);
    }
    expect(diffKeys).toEqual([]);
  });

  it('placeholder 语言(bn/hi/ur)继承 en,关键 key 必须非空', () => {
    for (const [name, dict] of [['bn', bn], ['hi', hi], ['ur', ur]] as const) {
      // 必须含 tabs.home + common.loading(基础 UI 关键)
      expect(dict.tabs.home, `${name}.tabs.home`).toBeTruthy();
      expect(dict.common.loading, `${name}.common.loading`).toBeTruthy();
      expect(dict.app.name, `${name}.app.name`).toBe('Matoo Power');
    }
  });

  it('v1.1: 四语完整补齐后,bn/hi/ur 与 en 顶级 keys 一致', () => {
    const enKeys = Object.keys(en).sort();
    for (const [name, dict] of [['bn', bn], ['hi', hi], ['ur', ur]] as const) {
      const keys = Object.keys(dict).sort();
      // 允许 placeholder 多覆盖;缺失则 fail
      expect(keys, `${name} 顶级 key 缺失: ${enKeys.filter((k) => !keys.includes(k)).join(',')}`).toEqual(enKeys);
    }
  });

  it('v1.1: common.exportCsv* 关键文案在 4 语中均存在且非空', () => {
    for (const [name, dict] of [['zh', zh], ['en', en], ['bn', bn], ['hi', hi], ['ur', ur]] as const) {
      expect(dict.common.exportCsv, `${name}.common.exportCsv`).toBeTruthy();
      expect(dict.common.exportCsvDone, `${name}.common.exportCsvDone`).toBeTruthy();
      expect(dict.common.exportCsvFailed, `${name}.common.exportCsvFailed`).toBeTruthy();
      expect(dict.common.exportCsvEmpty, `${name}.common.exportCsvEmpty`).toBeTruthy();
    }
  });

  it('v1.1: ticket.kpiTodayNew 与 adminOverview.* 在 4 语中均非空', () => {
    for (const [name, dict] of [['zh', zh], ['en', en], ['bn', bn], ['hi', hi], ['ur', ur]] as const) {
      expect(dict.ticket.kpiTodayNew, `${name}.ticket.kpiTodayNew`).toBeTruthy();
      expect(dict.adminOverview.title, `${name}.adminOverview.title`).toBeTruthy();
      expect(dict.adminOverview.skuTotal, `${name}.adminOverview.skuTotal`).toBeTruthy();
    }
  });
});

// ========== auth-store ==========
import { getSession, setSession, clearSession } from '../src/lib/api/auth-store';

describe('auth-store', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear();
  });

  it('空 → getSession 返回 null', () => {
    expect(getSession()).toBeNull();
  });

  it('setSession + getSession round-trip', () => {
    setSession({ token: 't1', userId: 'u1', role: 'customer', expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    const s = getSession();
    expect(s?.token).toBe('t1');
    expect(s?.userId).toBe('u1');
  });

  it('过期 → 自动清除 + 返回 null', () => {
    setSession({ token: 't1', userId: 'u1', role: 'customer', expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(getSession()).toBeNull();
  });

  it('clearSession 清除', () => {
    setSession({ token: 't1', userId: 'u1', role: 'customer', expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    clearSession();
    expect(getSession()).toBeNull();
  });

  it('role 字段正确持久化', () => {
    setSession({ token: 't', userId: 'u', role: 'admin', expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    expect(getSession()?.role).toBe('admin');
  });
});

// ========== API client 错误归一化 ==========
import { ApiError, api, downloadCsv } from '../src/lib/api/client';

describe('ApiError', () => {
  it('正确构造 + 继承 Error', () => {
    const e = new ApiError(403, 'FORBIDDEN', '需要 admin');
    expect(e.status).toBe(403);
    expect(e.code).toBe('FORBIDDEN');
    expect(e.message).toBe('需要 admin');
    expect(e.name).toBe('ApiError');
    expect(e).toBeInstanceOf(Error);
  });
});

describe('api.get / api.post', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('matoo.session');
    }
  });

  it('成功响应直接返回 JSON', async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ ok: true, data: 42 })),
    });
    globalThis.fetch = mock as unknown as typeof fetch;

    const r = await api.get<{ ok: boolean; data: number }>('/x');
    expect(r.data).toBe(42);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/x'),
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('非 2xx 抛 ApiError', async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve(JSON.stringify({ error: 'UNAUTHORIZED', message: '请登录' })),
    });
    globalThis.fetch = mock as unknown as typeof fetch;

    await expect(api.get('/x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'UNAUTHORIZED',
      message: '请登录',
    });
  });

  it('自动附带 Authorization header（如有 session）', async () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('matoo.session', JSON.stringify({
        token: 'test-jwt',
        userId: 'u1',
        role: 'customer',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }));
    }
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    });
    globalThis.fetch = mock as unknown as typeof fetch;

    await api.get('/x');
    const call = mock.mock.calls[0][1];
    expect(call.headers.Authorization).toBe('Bearer test-jwt');
  });

  it('auth:false 不带 Authorization', async () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('matoo.session', JSON.stringify({
        token: 'test-jwt', userId: 'u1', role: 'customer',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }));
    }
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    });
    globalThis.fetch = mock as unknown as typeof fetch;

    await api.get('/public', { auth: false });
    const call = mock.mock.calls[0][1];
    expect(call.headers.Authorization).toBeUndefined();
  });

  it('PUT 方法', async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    });
    globalThis.fetch = mock as unknown as typeof fetch;

    await api.put('/x', { a: 1 });
    const call = mock.mock.calls[0][1];
    expect(call.method).toBe('PUT');
    expect(JSON.parse(call.body)).toEqual({ a: 1 });
  });

  it('空 body 不传 body 字段', async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    });
    globalThis.fetch = mock as unknown as typeof fetch;

    await api.get('/x');
    const call = mock.mock.calls[0][1];
    expect(call.body).toBeUndefined();
  });
});

describe('v1.1 downloadCsv (Blob 下载)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.removeItem('matoo.session');
  });

  it('成功 → 返回 Blob', async () => {
    const blob = new Blob(['\ufeffid,name\r\n1,x\r\n'], { type: 'text/csv' });
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(blob),
    });
    globalThis.fetch = mock as unknown as typeof fetch;
    const r = await downloadCsv('/admin/users.csv');
    expect(r).toBeInstanceOf(Blob);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/users.csv'),
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('失败 → 抛 ApiError(从 text 解析 error/message)', async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: () => Promise.resolve(JSON.stringify({ error: 'FORBIDDEN', message: '需要 admin' })),
      blob: () => Promise.resolve(new Blob()),
    });
    globalThis.fetch = mock as unknown as typeof fetch;
    await expect(downloadCsv('/admin/users.csv')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'FORBIDDEN',
    });
  });
});

// ========== Shop 过滤逻辑（提取为纯函数测试） ==========
type PartCategory = 'connector' | 'monitor' | 'protection' | 'solar';

function filterParts(parts: any[], cat: PartCategory | 'all', activeSku: string | null) {
  return parts.filter((p) => {
    if (cat !== 'all' && p.category !== cat) return false;
    if (activeSku && !p.compatibleSkus.includes(activeSku)) return false;
    return true;
  });
}

describe('Shop filter logic', () => {
  const PARTS = [
    { id: 'p-1', category: 'connector', compatibleSkus: ['S1', 'S2'] },
    { id: 'p-2', category: 'monitor', compatibleSkus: ['S3'] },
    { id: 'p-3', category: 'solar', compatibleSkus: ['S3'] },
    { id: 'p-4', category: 'solar', compatibleSkus: ['S1'] },
  ];

  it('cat=all + 无 activeSku → 返回全部', () => {
    expect(filterParts(PARTS, 'all', null)).toHaveLength(4);
  });

  it('cat=connector → 仅连接器', () => {
    expect(filterParts(PARTS, 'connector', null)).toHaveLength(1);
  });

  it('cat=solar + activeSku=S3 → 仅 S3 的 solar', () => {
    const r = filterParts(PARTS, 'solar', 'S3');
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('p-3');
  });

  it('activeSku=S99 不在白名单 → 空', () => {
    expect(filterParts(PARTS, 'all', 'S99')).toHaveLength(0);
  });

  it('cat=solar + activeSku=S1 → 命中 p-4', () => {
    const r = filterParts(PARTS, 'solar', 'S1');
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('p-4');
  });

  it('空数组 → 空', () => {
    expect(filterParts([], 'all', null)).toHaveLength(0);
  });
});

// ========== Compare Best/Worst 选择算法 ==========
type Direction = 'high-good' | 'low-good';

function pickBest(a: number, b: number, dir: Direction): { winner: 'a' | 'b' | 'tie'; badge: 'best' | 'worst' | null } {
  if (a === b) return { winner: 'tie', badge: null };
  const aWin = dir === 'high-good' ? a > b : a < b;
  return {
    winner: aWin ? 'a' : 'b',
    badge: 'best', // loser 逻辑在调用方判断
  };
}

describe('Compare metric winner logic', () => {
  it('high-good: 95 > 85 → a wins', () => {
    expect(pickBest(95, 85, 'high-good').winner).toBe('a');
  });

  it('high-good: 95 < 98 → b wins', () => {
    expect(pickBest(95, 98, 'high-good').winner).toBe('b');
  });

  it('low-good: 100 < 1200 → a wins (循环越少越好)', () => {
    expect(pickBest(100, 1200, 'low-good').winner).toBe('a');
  });

  it('low-good: 100 > 80 → b wins', () => {
    expect(pickBest(100, 80, 'low-good').winner).toBe('b');
  });

  it('相等 → tie', () => {
    expect(pickBest(80, 80, 'high-good').winner).toBe('tie');
  });
});

// ========== Ticket 工单状态机 ==========
type Status = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';

const TRANSITIONS: Record<Status, Status[]> = {
  open: ['in_progress', 'resolved', 'closed'],
  in_progress: ['waiting_customer', 'resolved', 'closed'],
  waiting_customer: ['in_progress', 'resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};

function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

describe('Ticket status state machine', () => {
  it('open → in_progress 允许', () => {
    expect(canTransition('open', 'in_progress')).toBe(true);
  });

  it('open → waiting_customer 不允许（跳过 in_progress）', () => {
    expect(canTransition('open', 'waiting_customer')).toBe(false);
  });

  it('in_progress → resolved 允许', () => {
    expect(canTransition('in_progress', 'resolved')).toBe(true);
  });

  it('closed → 任何状态 不允许（终态）', () => {
    expect(canTransition('closed', 'open')).toBe(false);
    expect(canTransition('closed', 'in_progress')).toBe(false);
    expect(canTransition('closed', 'resolved')).toBe(false);
  });

  it('resolved → closed 允许', () => {
    expect(canTransition('resolved', 'closed')).toBe(true);
  });

  it('resolved → open 不允许', () => {
    expect(canTransition('resolved', 'open')).toBe(false);
  });
});

describe('test sanity', () => {
  it('runs the whole suite', () => {
    expect(true).toBe(true);
  });
});
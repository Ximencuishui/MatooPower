// Matoo Power Web — v1.4 P1-5 管理员审计日志页 单测
// 覆盖:加载态 → 列表渲染 → 过滤 Tab 切换 → 点击行打开 Drawer → payload 渲染

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import AdminAuditPage from '../src/app/admin/audit/page';

// ---------- 全局 mock ----------
const i18nMock = vi.hoisted(() => ({
  lang: { v: 'zh-CN' as string },
  t: {
    adminAudit: {
      title: '审计日志',
      empty: '暂无审计记录',
      filterAll: '全部',
      filterWarranty: '保修',
      filterTicket: '工单',
      filterUser: '用户',
      filterGdpr: 'GDPR',
      columnAction: '操作',
      columnResource: '资源',
      columnActor: '操作人',
      columnTime: '时间',
      columnIp: 'IP',
      payloadTitle: '审计载荷',
      loadMore: '加载更多',
      summary: '共 {n} 条记录',
    },
    common: { back: '返回' },
  },
}));

const guardMock = vi.hoisted(() => ({ status: 'ok' as 'ok' | 'pending' | 'denied' }));

const auditItems: Array<{
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  resource: string | null;
  payload: unknown;
  ip: string | null;
  createdAt: string;
}> = [
  {
    id: 'a-1',
    actorUserId: 'admin-uuid-001',
    actorRole: 'admin',
    action: 'AdminController.review.post',
    resource: 'admin:warranties:w-1',
    payload: { status: 'approved', note: 'ok' },
    ip: '127.0.0.1',
    createdAt: '2026-09-22T10:00:00.000Z',
  },
  {
    id: 'a-2',
    actorUserId: 'support-uuid-002',
    actorRole: 'support',
    action: 'AdminController.reply.post',
    resource: 'admin:tickets:t-2',
    payload: { text: '...已处理' },
    ip: '10.0.0.1',
    createdAt: '2026-09-22T10:05:00.000Z',
  },
  {
    id: 'a-3',
    actorUserId: 'admin-uuid-003',
    actorRole: 'admin',
    action: 'AdminController.removeUser.delete',
    resource: 'user:customer-99',
    payload: { anonymizedPhone: 'sha256:abcd1234' },
    ip: '127.0.0.1',
    createdAt: '2026-09-22T10:10:00.000Z',
  },
  {
    id: 'a-4',
    actorUserId: 'admin-uuid-004',
    actorRole: 'admin',
    action: 'AdminController.bulkReview.post',
    resource: 'admin:warranties:bulk',
    payload: null,
    ip: null,
    createdAt: '2026-09-22T10:15:00.000Z',
  },
];

const opMock = vi.hoisted(() => ({
  listAdminAudit: vi.fn(),
}));

vi.mock('@/lib/i18n', () => ({
  useT: () => ({ t: i18nMock.t, lang: i18nMock.lang.v }),
}));

vi.mock('@/lib/api/operations', () => ({
  listAdminAudit: (params?: unknown) => opMock.listAdminAudit(params),
}));

vi.mock('@/hooks/useRequireRole', () => ({
  useRequireRole: () => ({ status: guardMock.status }),
  RoleGuardView: ({ title }: { title: string }) => <div role="role-guard">{title}</div>,
}));

// Mock 依赖 Next App Router 的组件(测试环境无 next/navigation provider)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/audit',
}));
vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }) => <div role="topbar">{title}</div>,
  AdminBreadcrumb: () => null,
}));
vi.mock('@/components/Drawer', () => ({
  Drawer: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
    open ? (
      <div role="drawer">
        <div role="drawer-title">{title}</div>
        {children}
      </div>
    ) : null,
}));
vi.mock('@/components/PhoneShell', () => ({
  PhoneShell: ({ children }: { children: ReactNode }) => <div role="phone-shell">{children}</div>,
}));
vi.mock('@/components/ThemeQuickButton', () => ({
  ThemeQuickButton: () => null,
}));
vi.mock('@/components/LangSwitch', () => ({
  LangSwitch: () => null,
}));
vi.mock('@/components/Spinner', () => ({
  PageLoading: () => <div role="page-loading" />,
}));
vi.mock('@/components/ErrorBlock', () => ({
  ErrorBlock: ({ error, onRetry }: { error: unknown; onRetry: () => void }) => (
    <div role="error-block" onClick={onRetry}>{String(error)}</div>
  ),
}));
vi.mock('@/components/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div role="empty-state">{title}</div>,
}));

// ---------- 测试 ----------
describe('AdminAuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMock.status = 'ok';
    opMock.listAdminAudit.mockResolvedValue({ ok: true, total: auditItems.length, items: auditItems });
  });

  it('渲染页面骨架 — title + 5 个过滤 Tab', () => {
    const { container } = render(<AdminAuditPage />);
    expect(container.textContent).toContain('审计日志');
    const tabs = container.querySelectorAll('button[role="tab"]');
    expect(tabs.length).toBe(5);
    expect(tabs[0]?.textContent).toBe('全部');
    expect(tabs[1]?.textContent).toBe('保修');
    expect(tabs[2]?.textContent).toBe('工单');
    expect(tabs[3]?.textContent).toBe('用户');
    expect(tabs[4]?.textContent).toBe('GDPR');
  });

  it('加载完数据后总数摘要 = 共 4 条', async () => {
    const { container } = render(<AdminAuditPage />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain('共 4 条记录');
  });

  it('列表渲染每条审计:action + resource + IP', async () => {
    const { container } = render(<AdminAuditPage />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain('AdminController.review.post');
    expect(container.textContent).toContain('AdminController.reply.post');
    expect(container.textContent).toContain('AdminController.removeUser.delete');
    expect(container.textContent).toContain('admin:warranties:w-1');
    expect(container.textContent).toContain('127.0.0.1');
  });

  it('点击保修 Tab → 只显示 admin:warranties:* 条目', async () => {
    const { container } = render(<AdminAuditPage />);
    await act(async () => {
      await Promise.resolve();
    });
    const tabs = container.querySelectorAll('button[role="tab"]');
    await act(async () => {
      fireEvent.click(tabs[1]!); // 保修
    });
    expect(container.textContent).toContain('AdminController.review.post');
    expect(container.textContent).toContain('AdminController.bulkReview.post');
    expect(container.textContent).not.toContain('AdminController.reply.post');
    expect(container.textContent).not.toContain('AdminController.removeUser.delete');
    expect(container.textContent).toContain('共 2 条记录');
  });

  it('点击 GDPR Tab → 只显示 user:* 资源条目', async () => {
    const { container } = render(<AdminAuditPage />);
    await act(async () => {
      await Promise.resolve();
    });
    const tabs = container.querySelectorAll('button[role="tab"]');
    await act(async () => {
      fireEvent.click(tabs[4]!); // GDPR
    });
    expect(container.textContent).toContain('AdminController.removeUser.delete');
    expect(container.textContent).not.toContain('AdminController.reply.post');
    expect(container.textContent).toContain('共 1 条记录');
  });

  it('点击列表行 → Drawer 打开显示 payload', async () => {
    const { container } = render(<AdminAuditPage />);
    await act(async () => {
      await Promise.resolve();
    });
    // 找到第一行 audit 按钮 — 按钮包含 AdminController.review.post
    const buttons = Array.from(container.querySelectorAll('button'));
    const target = buttons.find((b) => b.textContent?.includes('AdminController.review.post'))!;
    await act(async () => {
      fireEvent.click(target);
    });
    expect(container.textContent).toContain('审计载荷');
    // JSON.stringify payload 后的字段
    expect(container.textContent).toContain('"status"');
    expect(container.textContent).toContain('"approved"');
  });

  it('payload 为 null 时 Drawer 显示 — 占位', async () => {
    const { container } = render(<AdminAuditPage />);
    await act(async () => {
      await Promise.resolve();
    });
    const buttons = Array.from(container.querySelectorAll('button'));
    const target = buttons.find((b) => b.textContent?.includes('AdminController.bulkReview.post'))!;
    await act(async () => {
      fireEvent.click(target);
    });
    expect(container.textContent).toContain('审计载荷');
    // payload=null 显示 —
    expect(container.textContent).toContain('—');
  });

  it('空数据 → 显示 empty 提示 + 共 0 条', async () => {
    opMock.listAdminAudit.mockResolvedValueOnce({ ok: true, total: 0, items: [] });
    const { container } = render(<AdminAuditPage />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain('暂无审计记录');
    expect(container.textContent).toContain('共 0 条记录');
  });
});
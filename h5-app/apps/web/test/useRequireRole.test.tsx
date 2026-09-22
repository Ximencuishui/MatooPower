// Matoo Power Web — useRequireRole 单元测试
// 覆盖：
//   1. 未登录 → need-login
//   2. token 已过期 → need-login（自动清理）
//   3. 角色在白名单内 → ok
//   4. 角色不在白名单内 → forbidden（含角色诊断信息）
//   5. admin 角色可访问 dealer 路由（白名单互访语义）
//   6. RoleGuardView 三种状态的可见分支（403 / 登录 / 检查中）

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { useRequireRole, RoleGuardView } from '../src/hooks/useRequireRole';
import {
  setSession,
  clearSession,
  type AuthSession,
} from '../src/lib/api/auth-store';

// i18n 上下文：RoleGuardView 内部 useT，需包 Provider
vi.mock('../src/lib/i18n', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/i18n')>('../src/lib/i18n');
  return {
    ...actual,
    useT: () => ({
      t: {
        common: {
          loginRequiredHint: '请先登录以访问该页面',
          goLogin: '去登录',
          logout: '退出登录',
        },
        auth: {
          needLogin: '需要登录',
        },
      },
      locale: 'zh-CN',
    }),
  };
});

// next/navigation mock：TopBar 内部 useRouter / usePathname 需要 App Router 上下文
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/admin/overview',
  useSearchParams: () => new URLSearchParams(),
}));

const SESSION_KEY = 'matoo.session';

function fakeSession(role: string, overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    token: `tok-${role}`,
    userId: `u-${role}`,
    role,
    displayName: `${role}-user`,
    phone: '+8801700000000',
    ...overrides,
  };
}

beforeEach(() => {
  clearSession();
});

afterEach(() => {
  clearSession();
});

describe('useRequireRole — 状态机', () => {
  it('无 session → need-login', async () => {
    const { result } = renderHook(() => useRequireRole(['admin']));
    // React 19 renderHook 自动 flush effect,初始 checking 已被覆盖
    await act(async () => {});
    expect(result.current.status).toBe('need-login');
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('session 已过期 → 自动清理 + need-login', async () => {
    setSession(fakeSession('admin', { expiresAt: new Date(Date.now() - 1000).toISOString() }));
    const { result } = renderHook(() => useRequireRole(['admin']));
    await act(async () => {});
    expect(result.current.status).toBe('need-login');
    // 过期 session 已被自动清理
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('角色在白名单内 → ok + session 回传', async () => {
    setSession(fakeSession('admin'));
    const { result } = renderHook(() => useRequireRole(['admin']));
    await act(async () => {});
    expect(result.current.status).toBe('ok');
    if (result.current.status === 'ok') {
      expect(result.current.session.role).toBe('admin');
      expect(result.current.session.token).toBe('tok-admin');
    }
  });

  it('角色不在白名单内 → forbidden + 携带诊断信息', async () => {
    setSession(fakeSession('customer'));
    const { result } = renderHook(() => useRequireRole(['admin']));
    await act(async () => {});
    expect(result.current.status).toBe('forbidden');
    if (result.current.status === 'forbidden') {
      expect(result.current.session.role).toBe('customer');
      expect(result.current.allowed).toEqual(['admin']);
    }
  });

  it('admin 角色可访问 dealer 路由 (白名单 = ["dealer", "admin"])', async () => {
    setSession(fakeSession('admin'));
    const { result } = renderHook(() => useRequireRole(['dealer', 'admin']));
    await act(async () => {});
    expect(result.current.status).toBe('ok');
  });

  it('customer 角色访问 dealer 路由 → forbidden', async () => {
    setSession(fakeSession('customer'));
    const { result } = renderHook(() => useRequireRole(['dealer', 'admin']));
    await act(async () => {});
    expect(result.current.status).toBe('forbidden');
  });

  it('dealer 角色访问 admin 路由 → forbidden', async () => {
    setSession(fakeSession('dealer'));
    const { result } = renderHook(() => useRequireRole(['admin']));
    await act(async () => {});
    expect(result.current.status).toBe('forbidden');
  });
});

describe('RoleGuardView — 视图分支', () => {
  it('checking 状态: 显示 "…" 占位', () => {
    const { container } = render(
      <RoleGuardView state={{ status: 'checking' }} title="管理面板" />,
    );
    expect(container.textContent).toContain('…');
    expect(container.textContent).toContain('管理面板');
  });

  it('need-login 状态: 显示登录入口 CTA + 提示文案', () => {
    const { container } = render(
      <RoleGuardView state={{ status: 'need-login' }} title="管理面板" />,
    );
    expect(container.textContent).toContain('需要登录');
    expect(container.textContent).toContain('请先登录以访问该页面');
    expect(container.textContent).toContain('去登录');
    // 必须含 /auth 链接
    const link = container.querySelector('a[href*="/auth"]');
    expect(link).not.toBeNull();
  });

  it('forbidden 状态: 显示 403 + 当前角色 + 需要角色', () => {
    const session = fakeSession('customer');
    const { container } = render(
      <RoleGuardView
        state={{ status: 'forbidden', session, allowed: ['admin'] }}
        title="管理面板"
      />,
    );
    expect(container.textContent).toContain('403');
    expect(container.textContent).toContain('无权访问');
    // 当前角色与需要角色都要出现（诊断信息）
    expect(container.textContent).toContain('customer');
    expect(container.textContent).toContain('admin');
    // 返回首页 + 退出按钮
    const homeLink = container.querySelector('a[href="/home"]');
    expect(homeLink).not.toBeNull();
    expect(container.querySelector('button')).not.toBeNull(); // 退出登录按钮
  });

  it('forbidden 状态: 多个 allowed 角色时用 / 分隔显示', () => {
    const session = fakeSession('customer');
    const { container } = render(
      <RoleGuardView
        state={{ status: 'forbidden', session, allowed: ['dealer', 'admin'] }}
        title="经销商面板"
      />,
    );
    expect(container.textContent).toContain('dealer');
    expect(container.textContent).toContain('admin');
    expect(container.textContent).toContain('/');
  });

  it('ok 状态: 不渲染守卫 UI（返回 null）', () => {
    const session = fakeSession('admin');
    const { container } = render(
      <RoleGuardView state={{ status: 'ok', session }} title="管理面板" />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ========== v1.1: support 角色 ==========
describe('useRequireRole — v1.1 support 角色', () => {
  it('support 角色访问 [admin, support] 白名单 → ok', async () => {
    setSession(fakeSession('support'));
    const { result } = renderHook(() => useRequireRole(['admin', 'support']));
    await act(async () => {});
    expect(result.current.status).toBe('ok');
  });

  it('support 角色访问 [admin] 单一白名单 → forbidden', async () => {
    setSession(fakeSession('support'));
    const { result } = renderHook(() => useRequireRole(['admin']));
    await act(async () => {});
    expect(result.current.status).toBe('forbidden');
    if (result.current.status === 'forbidden') {
      expect(result.current.session.role).toBe('support');
    }
  });

  it('customer 角色访问 [admin, support] 白名单 → forbidden', async () => {
    setSession(fakeSession('customer'));
    const { result } = renderHook(() => useRequireRole(['admin', 'support']));
    await act(async () => {});
    expect(result.current.status).toBe('forbidden');
  });
});

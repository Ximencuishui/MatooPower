// Matoo Power Web — 通用组件单元测试
// 覆盖：
//   PhoneShell:  children 渲染 / 非 PWA 无 is-pwa / standalone(PWA) 显示 is-pwa / 状态栏时间占位与 30s 刷新
//   TabBar:      5 tab 渲染与顺序 / 精确匹配高亮 / 子路径归属 /devices/compare → 设备 / 斜杠边界 /devicesx 不高亮 /
//                无匹配不高亮 / RTL(ur) 视觉顺序反转
//   Drawer:      open=false 不渲染 / dialog 语义(title+children) / backdrop 点击关闭 / Escape 关闭 / closeHref 优先于 onClose /
//                无回调不抛错
//   Toast:       未挂载导出函数不抛 / status 与 alert 角色 / 自动消失两段式(2s+180ms) / error 4.5s 延时 /
//                点击立即移除 / 多 toast 独立计时
//   Confirm:     trigger 渲染 / 默认与自定义 labels / 取消不触发 / 确认触发并关闭 / destructive 样式分支
//   Onboarding:  首访显示 / 已标记不显示 / 关闭落盘 / restart 重开 / 步骤导航(next/上一步) / 末步 start 收尾 /
//                tab 跳步 / skip

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { PhoneShell } from '../src/components/PhoneShell';
import { TabBar } from '../src/components/TabBar';
import { Drawer } from '../src/components/Drawer';
import { ToastHost, toast, toastSuccess, toastError } from '../src/components/Toast';
import { Confirm } from '../src/components/Confirm';
import { Onboarding, restartOnboarding } from '../src/components/Onboarding';

// 顶层 mock 资源：vi.hoisted 避免 vi.mock 工厂引用外部变量的 TDZ 问题
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  path: { v: '/home' },
  lang: { v: 'zh-CN' as string },
  t: {
    tabs: { home: '首页', devices: '设备', shop: '商城', messages: '消息', profile: '我的' },
    common: { cancel: '取消', confirm: '确认' },
    onboarding: {
      step1Title: '扫码绑定', step1Desc: '扫描设备二维码完成绑定',
      step2Title: '实时监控', step2Desc: '随时查看电池状态',
      step3Title: '快速售后', step3Desc: '一键发起工单',
      skip: '跳过', next: '下一步', start: '开始使用',
    },
  },
}));

// TabBar / Confirm / Onboarding 依赖 useT；TabBar / Drawer 依赖 next/navigation
vi.mock('@/lib/i18n', () => ({
  useT: () => ({ t: mocks.t, lang: mocks.lang.v }),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => mocks.path.v,
  useRouter: () => ({ push: mocks.push }),
}));

describe('PhoneShell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 起始 09:41:50:30s 后跨过 9:42 边界,可观测分钟刷新
    vi.setSystemTime(new Date(2026, 8, 21, 9, 41, 50));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('渲染 children 与 phone-shell 容器', () => {
    const { container } = render(
      <PhoneShell><p>页面内容</p></PhoneShell>,
    );
    expect(container.querySelector('.phone-shell')).not.toBeNull();
    expect(container.textContent).toContain('页面内容');
  });

  it('默认(非 standalone)不显示 is-pwa', () => {
    const { container } = render(<PhoneShell><p>x</p></PhoneShell>);
    expect(container.querySelector('.fake-statusbar')?.className).not.toContain('is-pwa');
  });

  it('standalone(PWA 全屏)时状态栏带 is-pwa', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const { container } = render(<PhoneShell><p>x</p></PhoneShell>);
    expect(container.querySelector('.fake-statusbar')?.className).toContain('is-pwa');
  });

  it('初始显示占位时间,30s interval 刷新', async () => {
    const { container } = render(<PhoneShell><p>x</p></PhoneShell>);
    // fake 时间 09:41:50 → 首帧渲染即当前时间
    expect(container.querySelector('.fake-statusbar')?.textContent).toContain('9:41');
    await act(async () => {
      vi.advanceTimersByTime(30_000); // 09:41:50 + 30s = 09:42:20 → 分钟翻转
    });
    expect(container.querySelector('.fake-statusbar')?.textContent).toContain('9:42');
  });
});

describe('TabBar', () => {
  beforeEach(() => {
    mocks.path.v = '/home';
    mocks.lang.v = 'zh-CN';
  });

  it('渲染 5 个 tab,顺序 首页在前', () => {
    const { container } = render(<TabBar />);
    const links = container.querySelectorAll('nav a');
    expect(links.length).toBe(5);
    expect(links[0]?.getAttribute('aria-label')).toBe('首页');
    expect(links[4]?.getAttribute('aria-label')).toBe('我的');
  });

  it('精确匹配:path=/home → 首页高亮,其余无 aria-current', () => {
    mocks.path.v = '/home';
    const { container } = render(<TabBar />);
    const links = container.querySelectorAll('nav a');
    links.forEach((a, i) => {
      const label = a.getAttribute('aria-label');
      expect(a.getAttribute('aria-current')).toBe(label === '首页' ? 'page' : null);
    });
  });

  it('子路径归属:/devices/compare → 设备高亮(compare 属于设备域)', () => {
    mocks.path.v = '/devices/compare';
    const { container } = render(<TabBar />);
    const active = container.querySelector('nav a[aria-current="page"]');
    expect(active?.getAttribute('aria-label')).toBe('设备');
  });

  it('斜杠边界:/devicesx 不匹配 /devices(完整路径匹配)', () => {
    mocks.path.v = '/devicesx';
    const { container } = render(<TabBar />);
    const links = container.querySelectorAll('nav a');
    const devices = Array.from(links).find((a) => a.getAttribute('aria-label') === '设备');
    expect(devices?.getAttribute('aria-current')).toBeNull();
  });

  it('无匹配路径 → 无任何 tab 高亮', () => {
    mocks.path.v = '/nope';
    const { container } = render(<TabBar />);
    expect(container.querySelector('nav a[aria-current="page"]')).toBeNull();
  });

  it('RTL(ur):视觉顺序反转,我的 在最前', () => {
    mocks.lang.v = 'ur';
    const { container } = render(<TabBar />);
    const links = container.querySelectorAll('nav a');
    expect(links[0]?.getAttribute('aria-label')).toBe('我的');
    expect(links[4]?.getAttribute('aria-label')).toBe('首页');
  });
});

describe('Drawer', () => {
  it('open=false → 不渲染任何内容', () => {
    const { container } = render(
      <Drawer open={false} onClose={() => {}} title="详情">内容</Drawer>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('open=true → dialog 语义 + title aria-label + children', () => {
    const { container } = render(
      <Drawer open title="工单详情" onClose={() => {}}>正文内容</Drawer>,
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-label')).toBe('工单详情');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(container.textContent).toContain('正文内容');
  });

  it('backdrop 点击 → onClose 调用', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Drawer open onClose={onClose} title="t">c</Drawer>,
    );
    fireEvent.click(container.querySelector('button[aria-label="close drawer"]')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape 键 → onClose 调用', () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose} title="t">c</Drawer>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closeHref 优先于 onClose → router.push', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Drawer open onClose={onClose} closeHref="/tickets" title="t">c</Drawer>,
    );
    fireEvent.click(container.querySelector('button[aria-label="close drawer"]')!);
    expect(mocks.push).toHaveBeenCalledWith('/tickets');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('无 onClose 且无 closeHref → 点击/Escape 不抛错', () => {
    const { container } = render(<Drawer open title="t">c</Drawer>);
    expect(() => {
      fireEvent.click(container.querySelector('button[aria-label="close drawer"]')!);
      fireEvent.keyDown(window, { key: 'Escape' });
    }).not.toThrow();
  });
});

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('未挂载宿主时导出函数不抛错(noop)', () => {
    expect(() => {
      toast('无人接收');
      toastSuccess('ok');
      toastError('boom');
    }).not.toThrow();
  });

  it('toast() → status 角色 + 消息文本', () => {
    const { container } = render(<ToastHost />);
    act(() => {
      toast('你好');
    });
    const el = container.querySelector('[role="status"]');
    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('你好');
  });

  it('toastError() → alert 角色 + ⚠ 前缀', () => {
    const { container } = render(<ToastHost />);
    act(() => {
      toastError('出错了');
    });
    const el = container.querySelector('[role="alert"]');
    expect(el).not.toBeNull();
    expect(el?.textContent).toContain('⚠');
    expect(el?.textContent).toContain('出错了');
  });

  it('success 两段式消失:2s 标 leaving,再 180ms 移除', async () => {
    const { container } = render(<ToastHost />);
    await act(async () => {
      toastSuccess('短暂消息'); // success kind = 2000ms
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    // 主时限到 → leaving 动画
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('.animate-toast-out')).not.toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(180);
    });
    expect(container.firstChild).toBeNull();
  });

  it('error 延时 4.5s 才进入 leaving(info 2400ms 已离开仍不离开,区分度断言)', async () => {
    const { container } = render(<ToastHost />);
    await act(async () => {
      toastError('严重错误');
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(container.querySelector('.animate-toast-out')).toBeNull();
    // 累计 4401ms > info(2400):若 kind 分支失效此刻已 leaving;error 必须仍在
    await act(async () => {
      vi.advanceTimersByTime(2401);
    });
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector('.animate-toast-out')).toBeNull();
    // 累计 4501ms ≥ error(4500) → leaving 动画
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(container.querySelector('.animate-toast-out')).not.toBeNull();
  });

  it('点击 toast 立即移除', () => {
    const { container } = render(<ToastHost />);
    act(() => {
      toast('点我消失');
    });
    fireEvent.click(container.querySelector('[role="status"]')!);
    expect(container.firstChild).toBeNull();
  });

  it('多 toast 独立计时:success 先走,info 后走', () => {
    const { container } = render(<ToastHost />);
    act(() => {
      toast('第一条', 'success');
      toast('第二条', 'info');
    });
    act(() => {
      vi.advanceTimersByTime(2180); // success 2180 移除,info 未到 2400
    });
    expect(container.textContent).toContain('第二条');
    expect(container.textContent).not.toContain('第一条');
    act(() => {
      vi.advanceTimersByTime(400); // info 2580 移除
    });
    expect(container.firstChild).toBeNull();
  });
});

describe('Confirm', () => {
  it('trigger 渲染;点击打开 dialog + title + description', () => {
    const { container } = render(
      <Confirm
        trigger={(open) => <button onClick={open}>删除设备</button>}
        title="确认删除?"
        description="删除后无法恢复"
        onConfirm={() => {}}
      ></Confirm>,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    fireEvent.click(container.querySelector('button')!);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('确认删除?');
    expect(dialog?.textContent).toContain('删除后无法恢复');
  });

  it('默认 labels 取 i18n common.confirm/cancel', () => {
    const { container } = render(
      <Confirm trigger={(open) => <button onClick={open}>x</button>} title="t" onConfirm={() => {}}></Confirm>,
    );
    fireEvent.click(container.querySelector('button')!);
    const buttons = container.querySelectorAll('[role="dialog"] button');
    expect(buttons[1]?.textContent).toBe('取消');
    expect(buttons[2]?.textContent).toBe('确认');
  });

  it('自定义 labels 覆盖默认', () => {
    const { container } = render(
      <Confirm
        trigger={(open) => <button onClick={open}>x</button>}
        title="t" confirmLabel="Delete" cancelLabel="Keep"
        onConfirm={() => {}}
      ></Confirm>,
    );
    fireEvent.click(container.querySelector('button')!);
    const buttons = container.querySelectorAll('[role="dialog"] button');
    expect(buttons[1]?.textContent).toBe('Keep');
    expect(buttons[2]?.textContent).toBe('Delete');
  });

  it('取消 → onConfirm 未调用,dialog 关闭', () => {
    const onConfirm = vi.fn();
    const { container } = render(
      <Confirm trigger={(open) => <button onClick={open}>x</button>} title="t" onConfirm={onConfirm}></Confirm>,
    );
    fireEvent.click(container.querySelector('button')!);
    fireEvent.click(container.querySelectorAll('[role="dialog"] button')[1]!);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('确认 → onConfirm 调用一次,dialog 关闭', () => {
    const onConfirm = vi.fn();
    const { container } = render(
      <Confirm trigger={(open) => <button onClick={open}>x</button>} title="t" onConfirm={onConfirm}></Confirm>,
    );
    fireEvent.click(container.querySelector('button')!);
    fireEvent.click(container.querySelectorAll('[role="dialog"] button')[2]!);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('destructive → 确认按钮红色样式分支', () => {
    const { container } = render(
      <Confirm trigger={(open) => <button onClick={open}>x</button>} title="t" onConfirm={() => {}} destructive></Confirm>,
    );
    fireEvent.click(container.querySelector('button')!);
    const confirmBtn = container.querySelectorAll('[role="dialog"] button')[2]!;
    expect(confirmBtn.className).toContain('bg-red-500');
  });

  it('非 destructive → 确认按钮主题色样式', () => {
    const { container } = render(
      <Confirm trigger={(open) => <button onClick={open}>x</button>} title="t" onConfirm={() => {}}></Confirm>,
    );
    fireEvent.click(container.querySelector('button')!);
    const confirmBtn = container.querySelectorAll('[role="dialog"] button')[2]!;
    expect(confirmBtn.className).toContain('bg-matoo');
  });
});

describe('Onboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('首次访问(无标记) → 打开引导,显示第一步', async () => {
    const { container } = render(<Onboarding />);
    await act(async () => {});
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('扫码绑定');
    expect(dialog?.textContent).toContain('📷');
  });

  it('已标记 → 引导不出现', async () => {
    localStorage.setItem('matoo.onboarded', '1');
    const { container } = render(<Onboarding />);
    await act(async () => {});
    expect(container.firstChild).toBeNull();
  });

  it('点击 × 关闭并落盘 localStorage', async () => {
    const { container } = render(<Onboarding />);
    await act(async () => {});
    fireEvent.click(container.querySelector('button[aria-label="关闭引导"]')!);
    expect(localStorage.getItem('matoo.onboarded')).toBe('1');
    expect(container.firstChild).toBeNull();
  });

  it('restartOnboarding() 后即使已标记也重新打开', async () => {
    localStorage.setItem('matoo.onboarded', '1');
    restartOnboarding();
    const { container } = render(<Onboarding />);
    await act(async () => {});
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('步骤导航:第一步 next → 第二步(图标切换 + 上一步出现),上一步返回', async () => {
    const { container } = render(<Onboarding />);
    await act(async () => {});
    expect(container.textContent).toContain('跳过');
    expect(container.textContent).not.toContain('上一步');
    fireEvent.click(Array.from(container.querySelectorAll('button')).find((b) => b.textContent === '下一步')!);
    expect(container.textContent).toContain('实时监控');
    expect(container.textContent).toContain('🛡');
    expect(container.textContent).toContain('上一步');
    expect(container.textContent).not.toContain('跳过');
    fireEvent.click(Array.from(container.querySelectorAll('button')).find((b) => b.textContent === '上一步')!);
    expect(container.textContent).toContain('扫码绑定');
  });

  it('末步 → start 收尾并落盘', async () => {
    const { container } = render(<Onboarding />);
    await act(async () => {});
    fireEvent.click(Array.from(container.querySelectorAll('button')).find((b) => b.textContent === '下一步')!);
    fireEvent.click(Array.from(container.querySelectorAll('button')).find((b) => b.textContent === '下一步')!);
    expect(container.textContent).toContain('快速售后');
    fireEvent.click(Array.from(container.querySelectorAll('button')).find((b) => b.textContent === '开始使用')!);
    expect(localStorage.getItem('matoo.onboarded')).toBe('1');
    expect(container.firstChild).toBeNull();
  });

  it('tab 圆点点击跳步', async () => {
    const { container } = render(<Onboarding />);
    await act(async () => {});
    fireEvent.click(container.querySelector('[role="tab"][aria-label="step 3"]')!);
    expect(container.textContent).toContain('快速售后');
  });

  it('skip 直接关闭并落盘', async () => {
    const { container } = render(<Onboarding />);
    await act(async () => {});
    fireEvent.click(Array.from(container.querySelectorAll('button')).find((b) => b.textContent === '跳过')!);
    expect(localStorage.getItem('matoo.onboarded')).toBe('1');
    expect(container.firstChild).toBeNull();
  });
});
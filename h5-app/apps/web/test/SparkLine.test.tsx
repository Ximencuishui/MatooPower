// Matoo Power Web — SparkLine 组件单元测试
// 覆盖：
//   1. 空数组 → "—" 占位(无 SVG)
//   2. 多值渲染:SVG role=img + aria-label 当前值 + polyline 坐标(归一化:min→底,max→顶)
//   3. 等值数组 → 无除零(range 兜底 1),折线平直
//   4. 单值数组 → 单点 + 仅 "now" X 标签
//   5. 最大/最小点高亮颜色分支(橙/红/绿)
//   6. 触摸/tooltip:getBoundingClientRect 模拟 → 最近点索引 + 时刻标签(-6h/-3h/now)
//   7. pointerLeave → tooltip 消失

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { SparkLine } from '../src/components/SparkLine';

describe('SparkLine', () => {
  it('空数组 → "—" 占位,不渲染 SVG', () => {
    const { container } = render(<SparkLine values={[]} />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toBe('—');
  });

  it('多值:SVG 语义 + aria-label 含当前(末)值 + polyline 归一化坐标', () => {
    const { container } = render(<SparkLine values={[50, 100, 0]} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toContain('当前 0%');
    // step = (320-16)/2 = 152;3 点:x=8/160/312;min=0→y=68.0,max=100→y=6.0,mid=50→y=37.0
    const polyline = container.querySelector('polyline');
    expect(polyline?.getAttribute('points')).toBe('8.0,37.0 160.0,6.0 312.0,68.0');
    // 数据点数量与 X 轴标签(-6h/-3h/now)
    expect(container.querySelectorAll('.spark-dot').length).toBe(3);
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    expect(texts).toEqual(expect.arrayContaining(['-6h', '-3h', 'now']));
  });

  it('等值数组 → range 兜底 1,无除零,折线平直', () => {
    const { container } = render(<SparkLine values={[42, 42, 42]} />);
    const polyline = container.querySelector('polyline');
    // (v-min)=0 → y 恒为 padTop+innerH = 68.0
    expect(polyline?.getAttribute('points')).toBe('8.0,68.0 160.0,68.0 312.0,68.0');
  });

  it('单值数组 → 单点 + 仅 now 标签,无 -6h', () => {
    const { container } = render(<SparkLine values={[7]} />);
    const polyline = container.querySelector('polyline');
    expect(polyline?.getAttribute('points')).toBe('8.0,68.0');
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    expect(texts).toContain('now');
    expect(texts).not.toContain('-6h');
  });

  it('最大/最小点高亮:max 橙、min 红、其余绿', () => {
    const { container } = render(<SparkLine values={[50, 100, 0]} />);
    const circles = Array.from(container.querySelectorAll('.spark-dot'));
    const byY = (c: Element) => Number(c.getAttribute('cy'));
    const sorted = circles.sort((a, b) => byY(a) - byY(b)); // y:6(max) → 37(mid) → 68(min)
    expect(sorted[0]?.getAttribute('fill')).toBe('#FF7A1A');
    expect(sorted[1]?.getAttribute('fill')).toBe('#0E8F5A');
    expect(sorted[2]?.getAttribute('fill')).toBe('#EF4444');
  });

  it('pointerMove → 最近点 tooltip(时刻标签 + 值)', () => {
    const { container } = render(<SparkLine values={[50, 100, 0]} />);
    const svg = container.querySelector('svg')!;
    // svgRef 读取的尺寸:模拟真实 320x90 布局坐标
    vi.spyOn(svg as unknown as SVGSVGElement, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 320, height: 90,
    } as DOMRect);
    // clientX=100 → xInSvg=100 → 距 p0(8)/p1(160)分别 92/60 → 最近 p1(100%)
    fireEvent.pointerMove(svg, { clientX: 100 });
    const tooltip = container.querySelector('[role="status"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toContain('100%');
    expect(tooltip?.textContent).toContain('-3h');
  });

  it('pointerMove 到最左端点 → -6h 时刻标签', () => {
    const { container } = render(<SparkLine values={[50, 100, 0]} />);
    const svg = container.querySelector('svg')!;
    vi.spyOn(svg as unknown as SVGSVGElement, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 320, height: 90,
    } as DOMRect);
    fireEvent.pointerMove(svg, { clientX: 8 });
    const tooltip = container.querySelector('[role="status"]');
    expect(tooltip?.textContent).toContain('50% · -6h');
  });

  it('pointerLeave → tooltip 消失', async () => {
    const { container } = render(<SparkLine values={[50, 100, 0]} />);
    const svg = container.querySelector('svg')!;
    vi.spyOn(svg as unknown as SVGSVGElement, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 320, height: 90,
    } as DOMRect);
    fireEvent.pointerMove(svg, { clientX: 100 });
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    fireEvent.pointerLeave(svg);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
'use client';
// P2-23:sparkline — SVG 自适应宽度、X 轴刻度、Y 轴数值、触摸/hover tooltip、入场画线动画
// 提取自 app/device/[id]/page.tsx(原页内私有组件),提升为公共组件以便单元测试
import { useState, useRef, type PointerEvent as ReactPointerEvent } from 'react';

export function SparkLine({ values }: { values: number[] }) {
  const [active, setActive] = useState<number>(-1);
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (values.length === 0) return <div className="text-xs text-slate-400">—</div>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const last = values[values.length - 1] ?? 0;
  const range = max - min || 1;
  const w = 320, h = 90, padX = 8, padTop = 6, padBottom = 22;
  const innerH = h - padTop - padBottom;
  const step = (w - padX * 2) / Math.max(values.length - 1, 1);

  const points = values.map((v, i) => {
    const x = padX + i * step;
    const y = padTop + innerH * (1 - (v - min) / range);
    return { x, y, v, i };
  });
  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const lastIdx = values.length - 1;
  const maxIdx = values.indexOf(max);
  const minIdx = values.indexOf(min);

  // 触摸/鼠标 clientX → 最近点索引(替代桌面 hover)
  function nearestIdx(clientX: number): number {
    if (!svgRef.current) return -1;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0) return -1;
    const xRatio = (clientX - rect.left) / rect.width;
    const xInSvg = Math.min(Math.max(xRatio * w, 0), w);
    let nearest = 0;
    let minDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - xInSvg);
      if (d < minDist) { minDist = d; nearest = i; }
    });
    return nearest;
  }

  function handleMove(e: ReactPointerEvent<SVGSVGElement>) {
    setActive(nearestIdx(e.clientX));
  }
  function handleLeave() { setActive(-1); }

  const activePoint = active >= 0 ? points[active] : null;

  // 时间标签:首/中/末(假设等距采样 6 小时)
  const xLabels = values.length <= 1
    ? [{ x: padX, label: 'now', anchor: 'start' as const }]
    : [
        { x: padX, label: '-6h', anchor: 'start' as const },
        { x: padX + Math.floor((values.length - 1) / 2) * step, label: '-3h', anchor: 'middle' as const },
        { x: w - padX, label: 'now', anchor: 'end' as const },
      ];

  // Y 轴标签:max / mid / min
  const mid = Math.round((max + min) / 2);
  const yLabels = [
    { v: max, y: padTop + 3 },
    { v: mid, y: padTop + innerH / 2 + 3 },
    { v: min, y: padTop + innerH + 3 },
  ];

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-20 select-none touch-none"
        role="img"
        aria-label={`SoC 趋势:最近 6 小时,当前 ${last}%`}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        onPointerCancel={handleLeave}
      >
        {/* 网格线 */}
        <line x1={padX} y1={padTop} x2={w - padX} y2={padTop} stroke="#E5E7EB" strokeDasharray="2 3" />
        <line x1={padX} y1={padTop + innerH / 2} x2={w - padX} y2={padTop + innerH / 2} stroke="#E5E7EB" strokeDasharray="2 3" />
        <line x1={padX} y1={padTop + innerH} x2={w - padX} y2={padTop + innerH} stroke="#E5E7EB" />

        {/* 折线(入场画线动画) */}
        <polyline
          points={polyline}
          fill="none"
          stroke="#0E8F5A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="sparkline-line"
        />

        {/* 数据点 */}
        {points.map((p, i) => {
          const isActive = i === active;
          const isLast = i === lastIdx;
          const isMax = i === maxIdx && maxIdx !== minIdx;
          const isMin = i === minIdx && maxIdx !== minIdx;
          const fill = isMax ? '#FF7A1A' : isMin ? '#EF4444' : '#0E8F5A';
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={isActive || isLast || isMax || isMin ? 3 : 1.8}
              fill={fill}
              opacity={isActive || isLast || isMax || isMin ? 1 : 0.55}
              className="spark-dot"
            >
              <title>{p.v}%</title>
            </circle>
          );
        })}

        {/* 活动点指示线 */}
        {activePoint && (
          <line
            x1={activePoint.x}
            y1={padTop}
            x2={activePoint.x}
            y2={padTop + innerH}
            stroke="#0E8F5A"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.5"
          />
        )}

        {/* X 轴时间标签 */}
        {xLabels.map((xl) => (
          <text
            key={xl.label}
            x={xl.x}
            y={h - 8}
            textAnchor={xl.anchor}
            fill="#94A3B8"
            fontSize="9"
          >
            {xl.label}
          </text>
        ))}

        {/* Y 轴数值标签 */}
        {yLabels.map((yl, i) => (
          <text
            key={`yl-${i}`}
            x={w - padX}
            y={yl.y}
            textAnchor="end"
            fill="#94A3B8"
            fontSize="9"
          >
            {yl.v}
          </text>
        ))}
      </svg>

      {/* 触摸/hover tooltip */}
      {activePoint && (
        <div
          className="spark-tooltip visible"
          style={{
            left: `${(activePoint.x / w) * 100}%`,
            top: `${(activePoint.y / h) * 100}%`,
          }}
          role="status"
          aria-live="polite"
        >
          {activePoint.v}% · {activePoint.i === 0 ? '-6h' : activePoint.i === lastIdx ? 'now' : `-${Math.round(6 - (activePoint.i / lastIdx) * 6)}h`}
        </div>
      )}
    </div>
  );
}
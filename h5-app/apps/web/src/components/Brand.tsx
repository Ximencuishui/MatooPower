'use client';
// 品牌 logo — 对齐 website/assets/logo.svg 的六边形 + 蓝绿渐变 M 标识
// 跨产品统一品牌识别:小尺寸仅图标(home 顶栏/设备卡),
// 中尺寸带 wordmark(启动屏/登录页),大尺寸全字标+POWER(品牌区)
//
// 颜色取自 website/assets/logo.svg:
//   - hexagon: #091E42(深蓝)
//   - gradient: #0052CC(蓝) → #36B37E(绿)
//   - accent: #36B37E(绿)
//   - wordmark text: #091E42 / #0052CC

import { ReactNode } from 'react';

const HEX_FILL = '#091E42';
const ACCENT = '#36B37E';
const GRAD_FROM = '#0052CC';
const GRAD_TO = '#36B37E';
const TEXT_DARK = '#091E42';
const TEXT_BLUE = '#0052CC';
const TEXT_LIGHT = '#B3D4FF';

type Variant = 'icon' | 'wordmark' | 'full';
type Tone = 'dark' | 'light';

const ICON_SVG = (
  <>
    {/* Hexagon */}
    <path d="M16 2 L30 10 L30 26 L16 34 L2 26 L2 10 Z" fill={HEX_FILL} />
    {/* M with gradient (same path as website) */}
    <path
      d="M8 24 L8 12 L12 12 L16 18 L20 12 L24 12 L24 24 L21 24 L21 15 L18 20 L14 20 L11 15 L11 24 Z"
      fill="url(#brandGrad)"
    />
    {/* Accent square */}
    <rect x="22" y="22" width="3" height="3" rx="0.5" fill={ACCENT} />
  </>
);

export function Brand({
  variant = 'icon',
  tone = 'dark',
  className = '',
  'aria-label': ariaLabel = 'Matoo Power',
}: {
  variant?: Variant;
  tone?: Tone;
  className?: string;
  'aria-label'?: string;
}) {
  // Icon-only: 32x36 viewBox (hexagon proportions)
  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 32 36"
        className={className}
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={GRAD_FROM} />
            <stop offset="100%" stopColor={GRAD_TO} />
          </linearGradient>
        </defs>
        {ICON_SVG}
      </svg>
    );
  }

  // Full wordmark + POWER label: 180x40 viewBox (matches website/assets/logo.svg)
  return (
    <svg
      viewBox="0 0 180 40"
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id="brandGradFull" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={GRAD_FROM} />
          <stop offset="100%" stopColor={GRAD_TO} />
        </linearGradient>
      </defs>
      <g transform="translate(4,4)">
        {/* Hexagon — tone-dependent fill */}
        <path
          d="M16 2 L30 10 L30 26 L16 34 L2 26 L2 10 Z"
          fill={tone === 'light' ? '#FFFFFF' : HEX_FILL}
        />
        <path
          d="M8 24 L8 12 L12 12 L16 18 L20 12 L24 12 L24 24 L21 24 L21 15 L18 20 L14 20 L11 15 L11 24 Z"
          fill="url(#brandGradFull)"
        />
        <rect x="22" y="22" width="3" height="3" rx="0.5" fill={ACCENT} />
      </g>
      <text
        x="46"
        y="21"
        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="17"
        fontWeight="700"
        fill={tone === 'light' ? '#FFFFFF' : TEXT_DARK}
        letterSpacing="-0.3"
      >
        Matoo
      </text>
      <text
        x="46"
        y="33"
        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="8"
        fontWeight="600"
        fill={tone === 'light' ? TEXT_LIGHT : TEXT_BLUE}
        letterSpacing="3.5"
      >
        POWER
      </text>
    </svg>
  );
}

/** 简化版 icon + 文字横排(topbar 用),自动 inline 布局 */
export function BrandInline({
  tone = 'dark',
  className = '',
  label,
}: {
  tone?: Tone;
  className?: string;
  label?: ReactNode;
}) {
  const textClass =
    tone === 'light' ? 'text-white' : 'text-[var(--matoo-ink,#0F172A)]';
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Brand variant="icon" tone={tone} className="w-7 h-8" />
      {label !== undefined ? (
        <span className={`font-semibold text-[15px] ${textClass}`}>{label}</span>
      ) : (
        <svg viewBox="0 0 60 16" className="h-4 w-auto" aria-hidden="true">
          <text
            x="0"
            y="12"
            fontFamily="Inter, sans-serif"
            fontSize="14"
            fontWeight="700"
            fill={tone === 'light' ? '#FFFFFF' : TEXT_DARK}
            letterSpacing="-0.2"
          >
            Matoo
          </text>
          <text
            x="48"
            y="12"
            fontFamily="Inter, sans-serif"
            fontSize="8"
            fontWeight="600"
            fill={tone === 'light' ? TEXT_LIGHT : TEXT_BLUE}
            letterSpacing="2"
          >
            POWER
          </text>
        </svg>
      )}
    </span>
  );
}
'use client';
// 社媒图标 — 对齐 website/assets/icon-{facebook,wechat,linkedin,twitter,youtube,instagram}.svg
// 视觉规范(从 website/styles/main.css 提取):
//   - 48x48 viewBox;背景圆 rgba(255,255,255,0.15) + 同色 1px stroke 环
//   - 白色路径;hover 时 brightness(1.1)(facebook 用 hue-rotate(0deg)+brightness(1.1))
//   - tone='dark':深底 + 白图标(默认,h5-app 卡片背景)
//   - tone='light':浅底 + 深图标(浅灰/白背景上)
//
// 平台清单与 website 完全一致(Facebook/WeChat/LinkedIn/Twitter/YouTube/Instagram),
// 另加 WhatsApp(h5-app 客服主通道,与 profile 中现有链接共用)

import { ReactNode } from 'react';

export type SocialPlatform =
  | 'facebook'
  | 'wechat'
  | 'linkedin'
  | 'twitter'
  | 'youtube'
  | 'instagram'
  | 'whatsapp';

type Tone = 'dark' | 'light';

// 平台路径(取自 website/assets/icon-*.svg,viewBox 48x48)
const PATHS: Record<SocialPlatform, ReactNode> = {
  facebook: (
    <path
      fill="#FFFFFF"
      d="M26.5 24h-3v10h-4.5V24h-2.3v-3.5h2.3v-2.3c0-3.3 1.4-5.2 5.2-5.2h3.3v3.6h-2c-1.5 0-1.6.6-1.6 1.6v2.3h3.6L26.5 24z"
    />
  ),
  wechat: (
    <>
      <path
        fill="#FFFFFF"
        d="M19 17c-4.4 0-8 2.8-8 6.3 0 2 1.1 3.8 2.8 5L13.5 29.5l2.5-1.3c.6.2 1.2.3 1.9.4-.1-.5-.2-1-.2-1.4 0-3.3 3.1-6 6.9-6 .2 0 .5 0 .7.1-.4-2.9-3.2-5.3-7.3-5.3zm-2.7 3.8c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zm5.4 0c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1z"
      />
      <path
        fill="#FFFFFF"
        d="M34 26c0-2.8-2.8-5-6.3-5s-6.3 2.2-6.3 5 2.8 5 6.3 5c.6 0 1.1-.1 1.6-.2L31.5 31l-.6-1.8c1.9-1 3.1-2.4 3.1-3.2zm-8.1-1.1c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm3.8 0c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7z"
      />
    </>
  ),
  linkedin: (
    <path
      fill="#FFFFFF"
      d="M19.5 34h-4.5V18h4.5V34zm-2.25-17.5c-1.5 0-2.75-1.25-2.75-2.75s1.25-2.75 2.75-2.75 2.75 1.25 2.75 2.75-1.25 2.75-2.75 2.75zM34 34h-4.5v-7.5c0-1.8-.04-4.1-2.5-4.1-2.5 0-2.9 2-2.9 4V34h-4.5V18h4.3v2.1h.07c.6-1.2 2.25-2.5 4.6-2.5 4.9 0 5.8 3.2 5.8 7.4V34z"
    />
  ),
  twitter: (
    <path
      fill="#FFFFFF"
      d="M30 16h3.5l-8 9.2L35 32h-7.5l-4.8-6.2L17 32h-3.5l8.5-9.8L13 16h7.7l4.3 5.6L30 16zm-1.3 14h2L18 18h-2L28.7 30z"
    />
  ),
  youtube: (
    <path
      fill="#FFFFFF"
      d="M34.5 20c-.3-1.3-1.4-2.4-2.7-2.7C29 17 24 17 24 17s-5 0-7.8.3c-1.3.3-2.4 1.4-2.7 2.7C13 22.5 13 24 13 24s0 1.5.5 4c.3 1.3 1.4 2.4 2.7 2.7 2.8.3 7.8.3 7.8.3s5 0 7.8-.3c1.3-.3 2.4-1.4 2.7-2.7.5-2.5.5-4 .5-4s0-1.5-.5-4zM22 27v-6l5 3-5 3z"
    />
  ),
  instagram: (
    <>
      <rect
        x="13"
        y="13"
        width="22"
        height="22"
        rx="6"
        ry="6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.5"
      />
      <circle cx="24" cy="24" r="5.5" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
      <circle cx="30.5" cy="17.5" r="1.5" fill="#FFFFFF" />
    </>
  ),
  whatsapp: (
    <path
      fill="#FFFFFF"
      d="M24 14c-5.5 0-10 4.5-10 10 0 1.8.5 3.5 1.3 4.9L14 34l5.3-1.3c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S29.5 14 24 14zm5.6 14.1c-.2.6-1.4 1.2-2 1.3-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.5-.6-2.7-1.2-4.4-3.9-4.5-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.2.1.4 0 .6-.1.2-.2.4-.3.5l-.3.4c-.1.1-.2.3-.1.5.1.2.5.9 1.2 1.5.8.7 1.5 1 1.7 1.1.2.1.4.1.5-.1l.6-.7c.1-.2.3-.2.5-.1.2.1 1.3.6 1.5.7.2.1.4.1.5.3 0 .1 0 .7-.2 1.4z"
    />
  ),
};

// tone 决定图标视觉:dark=深色圆形底+白 path(对齐 website footer);
// light=浅灰底+深 path(暗色模式 / 白底卡片友好)。
const TONE_STYLES: Record<Tone, { circle: string; ring: string }> = {
  dark: { circle: 'fill-white/15', ring: 'stroke-white/25' },
  light: { circle: 'fill-slate-100 dark:fill-slate-700', ring: 'stroke-slate-300 dark:stroke-slate-600' },
};

export function SocialIcon({
  platform,
  tone = 'dark',
  size = 32,
  ariaLabel,
}: {
  platform: SocialPlatform;
  tone?: Tone;
  size?: number;
  ariaLabel?: string;
}) {
  const t = TONE_STYLES[tone];
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="img"
      aria-label={ariaLabel ?? platform}
      className={`social-icon-${platform}`}
    >
      <circle cx="24" cy="24" r="24" className={t.circle} />
      <circle cx="24" cy="24" r="23" fill="none" className={t.ring} strokeWidth="1" />
      {tone === 'dark' ? (
        PATHS[platform]
      ) : (
        // light 模式需要把白色 path 改深色;通过 CSS 变量统一覆盖
        <g className="text-slate-700 dark:text-slate-300" fill="currentColor" stroke="currentColor">
          {PATHS[platform]}
        </g>
      )}
    </svg>
  );
}

export const SOCIAL_HINTS: Record<SocialPlatform, { color: string; label: string }> = {
  facebook:   { color: '#1877F2', label: 'Facebook' },
  wechat:     { color: '#07C160', label: 'WeChat' },
  linkedin:   { color: '#0A66C2', label: 'LinkedIn' },
  twitter:    { color: '#000000', label: 'X (Twitter)' },
  youtube:    { color: '#FF0000', label: 'YouTube' },
  instagram:  { color: '#E1306C', label: 'Instagram' },
  whatsapp:   { color: '#25D366', label: 'WhatsApp' },
};

/** 整行社媒链接 — 对齐 website 的 .footer-social-row */
export function SocialRow({
  links,
  tone = 'dark',
  size = 32,
  gap = 'gap-3',
}: {
  links: Partial<Record<SocialPlatform, string>>;
  tone?: Tone;
  size?: number;
  gap?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center ${gap}`}>
      {(Object.keys(links) as SocialPlatform[]).map((p) => {
        const href = links[p];
        if (!href) return null;
        const hint = SOCIAL_HINTS[p];
        return (
          <a
            key={p}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Follow Matoo Power on ${hint.label}`}
            className="social-icon-link"
            style={{ ['--social-color' as string]: hint.color }}
          >
            <SocialIcon platform={p} tone={tone} size={size} ariaLabel={hint.label} />
          </a>
        );
      })}
    </div>
  );
}
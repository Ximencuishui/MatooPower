import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Matoo Power · Admin Console',
  description: '运营管理后台（桌面端）',
  robots: { index: false, follow: false },
  // Favicon 与 website 同源：SVG 优先 + 多尺寸 PNG 回退 + apple-touch-icon
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0E8F5A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
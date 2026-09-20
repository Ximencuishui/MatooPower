import './globals.css';
import { I18nProvider } from '@/lib/i18n';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Matoo Power · 产品全生命周期服务',
  description: '扫码验真 → 保修激活 → 设备绑定 → 配件复购 → 售后工单',
  manifest: '/manifest.webmanifest',
  applicationName: 'Matoo Power',
  appleWebApp: { capable: true, title: 'Matoo Power', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0E8F5A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning：<html lang> 会在 I18nProvider 客户端水合后由 useEffect 同步为用户偏好语言
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <I18nProvider>{children}</I18nProvider>
        {/* Registers /sw.js in production builds for offline support */}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
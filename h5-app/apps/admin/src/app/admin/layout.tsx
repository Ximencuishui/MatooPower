// Admin 桌面端 layout：侧边栏 + 主内容区（横向 flex 布局,全宽 1440px+）
import { Sidebar } from '@/components/Sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto text-slate-900 dark:text-slate-100">
        {children}
      </main>
    </div>
  );
}
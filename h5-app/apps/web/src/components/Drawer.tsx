'use client';
// 全屏 Drawer(Dialog),用于客服工作台详情等需要"详尽视图"场景
// P2-11:加 slide-in 动画;P2-24:backdrop 加 focus-visible 轮廓
import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function Drawer({
  open,
  onClose,
  title,
  children,
  closeHref,
}: {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  /** 关闭时跳转到该 URL(替代 onClose);若两者都传,closeHref 优先 */
  closeHref?: string;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(id);
    }
    setMounted(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    if (closeHref) router.push(closeHref);
    else if (onClose) onClose();
  }

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="close drawer"
        className={`absolute inset-0 bg-black/40 backdrop-anim ${mounted ? 'backdrop-in' : ''} focus-visible:outline focus-visible:outline-2 focus-visible:outline-matoo focus-visible:outline-offset-[-2px]`}
        onClick={close}
      />
      <div className={`relative w-full max-w-md bg-white dark:bg-slate-800 shadow-2xl flex flex-col overflow-hidden animate-slide-up`}>
        {title && (
          <header className="topbar">
            <h2 className="text-[15px] font-semibold truncate min-w-0 px-2">{title}</h2>
            <button
              onClick={close}
              aria-label="close"
              className="text-slate-400 dark:text-slate-500 text-xl leading-none px-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-matoo"
            >
              ×
            </button>
          </header>
        )}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
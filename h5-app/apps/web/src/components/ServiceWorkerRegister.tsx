'use client';

import { useEffect } from 'react';

/**
 * ServiceWorkerRegister
 * ---------------------
 * Registers the production Service Worker shipped at /sw.js.
 * Disabled in development to avoid stale cache during HMR.
 *
 * 新版本可用时通过 toast() 提示用户刷新(P2-1)。
 */
import { toast } from './Toast';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                toast('新版本可用,请刷新页面 / New version available, please refresh', 'info');
                // 让用户主动刷新时激活新 SW
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                  window.location.reload();
                });
              }
            });
          });
        })
        .catch((err) => {
          console.warn('[SW] Registration failed:', err);
        });
    });
  }, []);

  return null;
}

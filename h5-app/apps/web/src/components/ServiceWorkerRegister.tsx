'use client';

import { useEffect } from 'react';

/**
 * ServiceWorkerRegister
 * ---------------------
 * Registers the production Service Worker shipped at /sw.js.
 * Disabled in development to avoid stale cache during HMR.
 *
 * See public/sw.js for the full offline strategy.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    // Defer registration so it doesn't block first paint.
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // Optional: listen for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available; prompt the user to refresh.
                console.info('[SW] New version available. Refresh to update.');
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

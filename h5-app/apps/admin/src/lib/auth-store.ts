// Admin 桌面端 session 存储（简化版）
// - localStorage 持久化（与 web 演示期一致）
// - 监听 storage 事件实现多 tab 同步
'use client';

import { useEffect, useState, useCallback } from 'react';
import { registerTokenGetter } from './api/client';
import type { AdminSessionUser } from './api/operations';

const STORAGE_KEY = 'matoo.admin.session.v1';

export interface AdminSession {
  token: string;
  user: AdminSessionUser;
}

function readFromStorage(): AdminSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminSession;
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(s: AdminSession | null) {
  if (typeof window === 'undefined') return;
  if (s) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  else window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('matoo-admin-session-change'));
}

// 注册 token 读取器 — api/client 调用 fetch 时会拿到最新 token
registerTokenGetter(() => readFromStorage()?.token ?? null);

export function setSession(s: AdminSession) {
  writeToStorage(s);
}

export function clearSession() {
  writeToStorage(null);
}

export function getSession(): AdminSession | null {
  return readFromStorage();
}

/** React hook：订阅 session 变化（多 tab 同步） */
export function useSession() {
  const [session, setSessionState] = useState<AdminSession | null>(null);

  useEffect(() => {
    setSessionState(readFromStorage());
    const handler = () => setSessionState(readFromStorage());
    window.addEventListener('matoo-admin-session-change', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('matoo-admin-session-change', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return session;
}

export function useLogout() {
  return useCallback(() => {
    clearSession();
  }, []);
}
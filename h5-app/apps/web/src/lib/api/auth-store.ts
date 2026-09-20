// JWT 持久化：localStorage，浏览器端可用。
// 生产期可考虑换 httpOnly cookie，但演示期保持简单。

export type AuthSession = {
  token: string;
  userId: string;
  role: 'customer' | 'dealer' | 'admin' | string;
  displayName?: string;
  phone?: string;
  expiresAt?: string; // ISO
};

const KEY = 'matoo.session';

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AuthSession;
    if (s.expiresAt && new Date(s.expiresAt).getTime() < Date.now()) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function setSession(s: AuthSession) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}
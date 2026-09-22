// P0-1 v1.2:JWT 持久化策略
// - httpOnly cookie(主通道,后端 Set-Cookie matoo_token,SameSite=Strict)
// - localStorage(兜底,仅存 user 角色元数据,不存 token)
// - 演示期前端仍可临时缓存 token 到 localStorage 以保持 401 快速判定;
//   生产期应只保留 metadata,依赖 cookie 由 jwt.strategy 自动读取
import { logout as httpLogout } from './operations';

export type AuthSession = {
  token?: string;            // v1.2:可选,演示期 localStorage 缓存;生产期只存 cookie
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

// P0-1 v1.2:clearSession 同时清后端 cookie,失败兜底仍清本地
export async function clearSession(): Promise<void> {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
  try {
    await httpLogout();
  } catch {
    /* 离线/服务端不可达 — 仅清 localStorage 已足够,演示期不阻塞 */
  }
}
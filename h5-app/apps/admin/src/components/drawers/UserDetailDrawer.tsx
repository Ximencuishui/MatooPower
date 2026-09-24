// Admin 用户详情 Drawer
// - 用户基本信息 + 角色 + 关联保修列表
// - 内联角色切换（PATCH /admin/users/:id/role）
'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '@/components/Drawer';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';
import {
  getUserDetail,
  updateUserRole,
  suspendUser,
  unsuspendUser,
  type UserDetail,
} from '@/lib/api/operations';
import { ApiError } from '@/lib/api/client';

type Role = 'admin' | 'dealer' | 'customer';
const ROLE_LABEL: Record<Role, string> = {
  admin: '管理员',
  dealer: '经销商',
  customer: '客户',
};
const ROLE_COLOR: Record<Role, string> = {
  admin: 'chip-rose',
  dealer: 'chip-blue',
  customer: 'chip-slate',
};

const WARRANTY_STATUS_COLOR: Record<string, string> = {
  active: 'chip-emerald',
  pending: 'chip-amber',
  expired: 'chip-slate',
  rejected: 'chip-rose',
};

interface Props {
  userId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export function UserDetailDrawer({ userId, open, onClose, onChanged }: Props) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  // v1.5 #P1-3:isActive 字段(后端 getUserDetail 当前 SELECT 未返回,需要后端返回或后加请求)
  // 为不阻塞 UI,从列表 chip 中读 isActive 状态会有穿透问题;此处维护本地副本
  const [isActive, setIsActive] = useState<boolean>(true);
  const [suspendReason, setSuspendReason] = useState<string>('');
  const [acting, setActing] = useState<null | 'suspend' | 'unsuspend'>(null);

  useEffect(() => {
    if (!open || !userId) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    getUserDetail(userId, ctrl.signal)
      .then((r) => {
        setUser(r.user);
        // v1.5 #P1-3:后端返回 isActive / suspendedReason 后同步到本地 state
        const u = r.user as any;
        setIsActive(u.isActive === undefined ? true : u.isActive === 1 || u.isActive === true);
        if (u.suspendedReason) setSuspendReason(u.suspendedReason);
      })
      .catch((e) => setError(e as Error))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [open, userId]);

  async function handleRoleChange(next: Role) {
    if (!user || saving || user.role === next) return;
    setSaving(true);
    try {
      await updateUserRole(user.id, next);
      const fresh = await getUserDetail(user.id);
      setUser(fresh.user);
      onChanged?.();
    } catch (e) {
      alert('角色更新失败: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // v1.5 #P1-3:暂停 / 恢复账户
  async function handleSuspend() {
    if (!user || acting) return;
    const reason = suspendReason.trim() || '管理员手动停用';
    if (!window.confirm(`暂停用户 ${user.phone ?? user.id}?\n原因: ${reason}\n该用户后续将被拒绝登录`)) return;
    setActing('suspend');
    try {
      const r = await suspendUser(user.id, reason);
      setIsActive((r.user as any).isActive === 1 || (r.user as any).isActive === true);
      onChanged?.();
    } catch (e) {
      alert('停用失败: ' + (e as Error).message);
    } finally {
      setActing(null);
    }
  }
  async function handleUnsuspend() {
    if (!user || acting) return;
    if (!window.confirm(`恢复用户 ${user.phone ?? user.id} 登录?`)) return;
    setActing('unsuspend');
    try {
      const r = await unsuspendUser(user.id);
      setIsActive((r.user as any).isActive === 1 || (r.user as any).isActive === true);
      onChanged?.();
    } catch (e) {
      alert('恢复失败: ' + (e as Error).message);
    } finally {
      setActing(null);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="用户详情"
      subtitle={user?.phone ?? userId ?? ''}
      width="lg"
    >
      {loading && <PageLoading />}
      {error && <ErrorBlock error={error} />}
      {user && !loading && !error && (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500 mb-1">手机号</div>
              <div className="font-mono">{user.phone ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">邮箱</div>
              <div className="font-mono text-xs truncate">{user.email ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">显示名</div>
              <div className="font-medium">{user.displayName ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">注册时间</div>
              <div className="font-mono text-xs">{user.createdAt}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-slate-500 mb-1">当前角色</div>
              <span className={`chip ${ROLE_COLOR[user.role]}`}>
                {ROLE_LABEL[user.role]}
              </span>
            </div>
          </section>

          <section>
            <div className="text-xs text-slate-500 mb-2 flex items-center justify-between">
              <span>变更角色</span>
              <span className={`chip ${isActive ? 'chip-emerald' : 'chip-rose'}`}>
                {isActive ? '账户正常' : '账户已停用'}
              </span>
            </div>
            <div className="flex gap-2">
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleChange(r)}
                  disabled={saving || user.role === r}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                    user.role === r
                      ? 'bg-matoo-light dark:bg-matoo/20 border-matoo text-matoo-dark dark:text-matoo-light font-semibold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  } disabled:opacity-50`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </section>

          {/* v1.5 #P1-3:账户 Suspension */}
          <section className="card p-3 bg-slate-50 dark:bg-slate-800/40">
            <div className="text-xs text-slate-500 mb-2 flex items-center justify-between">
              <span>Suspension (v1.5)</span>
              {!isActive && (
                <span className="text-rose-600 text-[10px]">该用户登录将被 JwtStrategy 拒绝</span>
              )}
            </div>
            {isActive ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="停用原因(可选)"
                  className="input flex-1 text-xs"
                  maxLength={120}
                />
                <button
                  type="button"
                  onClick={handleSuspend}
                  disabled={acting === 'suspend'}
                  className="px-3 py-1.5 text-xs rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50"
                >
                  {acting === 'suspend' ? '停用中…' : '停用账户'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleUnsuspend}
                disabled={acting === 'unsuspend'}
                className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {acting === 'unsuspend' ? '恢复中…' : '恢复账户'}
              </button>
            )}
          </section>

          <section>
            <div className="text-xs text-slate-500 mb-2">
              保修记录 · 共 {user.warrantyCount} 条
            </div>
            <div className="space-y-2">
              {user.warranties.length === 0 && (
                <div className="text-sm text-slate-400 italic">暂无保修记录</div>
              )}
              {user.warranties.map((w) => (
                <div key={w.id} className="card p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {w.s_modelName ?? w.s_sku ?? w.skuId}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 truncate">
                      {w.s_serial ?? '—'} · {w.country ?? '—'} · {w.createdAt}
                    </div>
                  </div>
                  <span
                    className={`chip ${WARRANTY_STATUS_COLOR[w.status] ?? 'chip-slate'} ml-3 shrink-0`}
                  >
                    {w.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}
// Admin 审计日志详情 Drawer —— 显示 payload 完整内容
'use client';

import { Drawer } from '@/components/Drawer';
import type { AuditLogItem } from '@/lib/api/operations';

interface Props {
  log: AuditLogItem | null;
  open: boolean;
  onClose: () => void;
}

export function AuditDetailDrawer({ log, open, onClose }: Props) {
  if (!log) return null;

  let formattedPayload = log.payload ?? '';
  try {
    if (formattedPayload) {
      const obj = JSON.parse(formattedPayload);
      formattedPayload = JSON.stringify(obj, null, 2);
    }
  } catch {
    // 留原文
  }

  return (
    <Drawer open={open} onClose={onClose} title="审计日志详情" subtitle={log.id} width="lg">
      <div className="space-y-4">
        <Row label="操作人" value={log.actorUserId ?? '—'} mono />
        <Row label="角色" value={log.actorRole ?? '—'} />
        <Row label="动作" value={log.action} />
        <Row label="资源" value={log.resource ?? '—'} mono />
        <Row label="IP" value={log.ip ?? '—'} mono />
        <Row label="时间" value={new Date(log.createdAt).toLocaleString('zh-CN')} />
        <Row label="User-Agent" value={log.userAgent ?? '—'} />

        <div>
          <label className="text-[11px] uppercase tracking-wide text-slate-500">载荷 (Payload)</label>
          <pre className="mt-1 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono whitespace-pre-wrap break-all max-h-[400px] overflow-auto">
            {formattedPayload || '—'}
          </pre>
        </div>
      </div>
    </Drawer>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[11px] uppercase tracking-wide text-slate-500 min-w-[80px] mt-0.5">
        {label}
      </span>
      <span className={`text-sm ${mono ? 'font-mono' : ''} break-all`}>{value}</span>
    </div>
  );
}
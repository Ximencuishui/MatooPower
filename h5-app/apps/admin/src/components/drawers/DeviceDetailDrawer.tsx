// Admin 设备详情 Drawer（紧凑视图 —— 基础信息 + 实时遥测 + 关联用户）
'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '@/components/Drawer';
import { PageLoading } from '@/components/PageLoading';
import { ErrorBlock } from '@/components/ErrorBlock';
import { api } from '@/lib/api/client';

interface DeviceHealth {
  ok: true;
  device: {
    id: string;
    skuId: string;
    userId: string;
    soh: number | null;
    soc: number | null;
    cycles: number | null;
    temp: number | null;
    volt: number | null;
    curr: number | null;
    fw: string | null;
    alarms: number | null;
    boundAt: string;
    lastSeenAt: string;
  };
}

interface DeviceWarrantyLite {
  id: string;
  skuId: string;
  status: string;
  startAt: string;
  endAtWhole: string;
}

interface DeviceDetail {
  health: DeviceHealth['device'] | null;
  warranty: DeviceWarrantyLite | null;
}

interface Props {
  deviceId: string | null;
  open: boolean;
  onClose: () => void;
}

export function DeviceDetailDrawer({ deviceId, open, onClose }: Props) {
  const [detail, setDetail] = useState<DeviceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!open || !deviceId) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setDetail(null);
    api
      .get<DeviceHealth>(`/admin/device/${deviceId}/health`, { signal: ctrl.signal })
      .then((r) => {
        setDetail({
          health: r.device,
          warranty: null, // 关联保修如需可后续加 /warranty/by-sku
        });
      })
      .catch((e) => setError(e as Error))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [open, deviceId]);

  return (
    <Drawer open={open} onClose={onClose} title={`设备详情`} subtitle={deviceId ?? ''} width="md">
      {loading && <PageLoading />}
      {error && <ErrorBlock error={error} onRetry={() => onClose()} />}
      {detail && detail.health && (
        <div className="space-y-5">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              基础信息
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="设备 ID" value={detail.health.id} mono />
              <Field label="SKU ID" value={detail.health.skuId} mono />
              <Field label="用户 ID" value={detail.health.userId} mono />
              <Field label="绑定时间" value={new Date(detail.health.boundAt).toLocaleString('zh-CN')} />
              <Field label="最近上报" value={new Date(detail.health.lastSeenAt).toLocaleString('zh-CN')} />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              实时遥测
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Telemetry label="SOH" value={detail.health.soh} unit="%" good={(v) => v >= 80} />
              <Telemetry label="SOC" value={detail.health.soc} unit="%" good={(v) => v >= 20} />
              <Telemetry label="循环" value={detail.health.cycles} unit="次" />
              <Telemetry label="温度" value={detail.health.temp} unit="°C" />
              <Telemetry label="电压" value={detail.health.volt} unit="V" />
              <Telemetry label="电流" value={detail.health.curr} unit="A" />
              <Field label="固件" value={detail.health.fw ?? '—'} mono />
              <Telemetry label="告警" value={detail.health.alarms} unit="条" bad={(v) => v > 0} />
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`text-sm mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function Telemetry({
  label,
  value,
  unit,
  good,
  bad,
}: {
  label: string;
  value: number | null;
  unit: string;
  good?: (v: number) => boolean;
  bad?: (v: number) => boolean;
}) {
  let color = 'text-slate-700';
  if (value !== null && good && good(value)) color = 'text-emerald-600';
  if (value !== null && bad && bad(value)) color = 'text-rose-600';
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`text-base font-semibold mt-0.5 ${color}`}>
        {value === null ? '—' : `${value}${unit}`}
      </span>
    </div>
  );
}
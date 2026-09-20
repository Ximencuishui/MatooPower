import type { SkuId } from './sku.js';
import type { UserId } from './user.js';

export type DeviceId = string & { readonly __brand: 'DeviceId' };
export type DeviceSerial = string & { readonly __brand: 'DeviceSerial' };

export interface DeviceTelemetry {
  soh: number; // 0..1
  soc: number; // 0..1
  cycles: number;
  tempC: number;
  voltageV: number;
  currentA: number;
}

export interface DeviceAlarm {
  code: string;
  level: 'info' | 'warn' | 'crit';
  message: string;
  raisedAt: string; // ISO-8601
}

export interface Device {
  id: DeviceId;
  serial: DeviceSerial;
  skuId: SkuId;
  ownerId?: UserId;
  fwVersion?: string;
  boundAt?: string; // ISO-8601
  telemetry?: DeviceTelemetry;
  alarms?: DeviceAlarm[];
}
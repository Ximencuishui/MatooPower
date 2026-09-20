export interface DeviceEntity {
  id: string;
  skuId: string;
  userId: string;
  boundAt: string;
  lastSeenAt: string;
  soh: number | null;
  soc: number | null;
  cycles: number | null;
  temp: number | null;
  volt: number | null;
  curr: number | null;
  fw: string | null;
  alarms: number | null;
}
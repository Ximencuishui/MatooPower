import { z } from 'zod';

export const bindDeviceSchema = z.object({
  skuId: z.string().min(1),
  serial: z.string().min(1).max(64),
  /** Optional override; defaults to currently logged-in user on api side. */
  ownerId: z.string().optional(),
  /** Optional device-side pairing token (BLE / NFC) */
  pairingToken: z.string().min(1).max(256).optional(),
});
export type BindDeviceDto = z.infer<typeof bindDeviceSchema>;
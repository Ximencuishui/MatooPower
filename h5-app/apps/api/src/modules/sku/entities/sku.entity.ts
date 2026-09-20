// SKU 实体视图（前端消费用）
export interface SkuEntity {
  id: string;
  sku: string;
  serial: string;
  batch: string;
  mfgDate: string;
  modelName: string;
  family: string;
  capacity: string;
  voltage: string;
  chemistry: string;
  cycles: string;
  warranty: {
    whole: number;
    cell: number | null;
    bms: number | null;
    parts: number | null;
  };
  activated: boolean;
  activatedAt: string | null;
  activatedBy: string | null;
}
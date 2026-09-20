// SKU / product catalog types.

export type SkuId = string & { readonly __brand: 'SkuId' };

export type Chemistry = 'LFP' | 'NMC' | 'LTO' | 'LeadAcid';

export interface SkuSpec {
  capacityAh: number;
  voltageV: number;
  chemistry: Chemistry;
  cycles: number;
}

export interface Sku {
  id: SkuId;
  model: string;
  /** Localized display name (zh-CN). */
  nameZh: string;
  /** Localized display name (en). */
  nameEn: string;
  spec: SkuSpec;
  manualUrl?: string;
  videoUrl?: string;
}
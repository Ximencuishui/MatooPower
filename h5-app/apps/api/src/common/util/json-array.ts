// JSON 字符串数组解析工具（统一容错/强校验语义）
// - parseStringArray: 容错版，损坏返回 []（用于读路径：list / getCatalog 等）
// - assertStringArray: 强校验版，损坏抛 BadRequestException（用于写路径：updateCatalog 等）
//
// 背景：SQLite 无原生数组类型，List<string> 列以 JSON 字符串持久化
// 所有 DB 反序列化都应走这里，避免各模块 try/catch 复制粘贴
import { BadRequestException } from '@nestjs/common';

/** 容错解析：JSON 数组字符串 → string[]（损坏/null/undefined → []） */
export function parseStringArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((u): u is string => typeof u === 'string');
  } catch {
    return [];
  }
}

/** 强校验解析：JSON 数组字符串 → string[]（损坏抛 BadRequestException） */
export function assertStringArray(json: string, field = 'value'): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new BadRequestException(`${field} 必须为合法 JSON 字符串`);
  }
  if (!Array.isArray(parsed) || !parsed.every((u): u is string => typeof u === 'string')) {
    throw new BadRequestException(`${field} 必须为字符串数组`);
  }
  return parsed;
}
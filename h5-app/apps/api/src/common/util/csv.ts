// 简单 CSV 序列化器（无依赖；RFC 4180 兼容）
// - 字段含 , " 或换行 → 用双引号包裹,内部 " 转义为 ""
// - 字段值为 null/undefined → 输出空字符串
// - 字段值为对象/数组 → JSON.stringify
// - 行结束符 \r\n(Excel 友好)

export function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s: string;
  if (typeof v === 'string') s = v;
  else if (typeof v === 'number' || typeof v === 'boolean') s = String(v);
  else s = JSON.stringify(v);
  // BOM 前缀可让 Excel 识别 UTF-8(中文/孟加拉文不乱码)
  const needsQuote = /[",\r\n]/.test(s);
  if (!needsQuote) return s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns?: (keyof T)[]): string {
  if (rows.length === 0) {
    return columns ? columns.map((c) => csvEscape(c as string)).join(',') + '\r\n' : '';
  }
  const cols = columns ?? (Object.keys(rows[0]!) as (keyof T)[]);
  const header = cols.map((c) => csvEscape(c as string)).join(',');
  const body = rows
    .map((r) => cols.map((c) => csvEscape(r[c])).join(','))
    .join('\r\n');
  return header + '\r\n' + body + '\r\n';
}

export const CSV_BOM = '\ufeff';
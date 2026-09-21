// v1.1 CSV 序列化器单元测试(API 端使用 jest,无 vitest 依赖)

import { toCsv, csvEscape, CSV_BOM } from './csv';

describe('csvEscape', () => {
  it('null/undefined → 空字符串', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });
  it('数字/布尔 → 字符串原样', () => {
    expect(csvEscape(123)).toBe('123');
    expect(csvEscape(true)).toBe('true');
    expect(csvEscape(false)).toBe('false');
  });
  it('普通字符串原样', () => {
    expect(csvEscape('hello')).toBe('hello');
  });
  it('含逗号 → 加双引号包裹', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
  });
  it('含双引号 → 双引号转义 + 包裹', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });
  it('含换行 → 加双引号包裹', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"');
  });
  it('对象 → JSON 后正常转义', () => {
    expect(csvEscape({ a: 1 })).toBe('"{""a"":1}"');
  });
});

describe('toCsv', () => {
  it('空数组 → 仅 header(若指定列名)', () => {
    expect(toCsv([], ['id', 'name'])).toBe('id,name\r\n');
  });
  it('空数组 + 无 columns → 空字符串', () => {
    expect(toCsv([])).toBe('');
  });
  it('基本行 + 自动推断列名', () => {
    const rows = [{ a: 1, b: 'x' }, { a: 2, b: 'y' }];
    expect(toCsv(rows)).toBe('a,b\r\n1,x\r\n2,y\r\n');
  });
  it('columns 参数限制列顺序与过滤', () => {
    const rows = [{ a: 1, b: 'x', c: '隐藏' }];
    expect(toCsv(rows, ['a', 'c'])).toBe('a,c\r\n1,隐藏\r\n');
  });
  it('多行 + 含特殊字符全部正确转义', () => {
    const rows = [
      { id: 1, name: '张三', note: 'hello,world' },
      { id: 2, name: 'Li "Bob"', note: 'a\nb' },
    ];
    const out = toCsv(rows);
    expect(out).toBe('id,name,note\r\n1,张三,"hello,world"\r\n2,"Li ""Bob""","a\nb"\r\n');
  });
  it('CRLF 行结束符(Excel 友好)', () => {
    expect(toCsv([{ a: 1 }])).toMatch(/\r\n$/);
  });
});

describe('CSV_BOM', () => {
  it('为 UTF-8 BOM \\ufeff', () => {
    expect(CSV_BOM).toBe('\ufeff');
  });
});
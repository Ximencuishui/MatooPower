import { expect, type Page } from '@playwright/test';
import * as os from 'os';
import * as path from 'path';

// 测试库固定路径（与 playwright.config.ts TEST_DB / global-setup.ts 同一公式）
const TEST_DB = path.join(os.tmpdir(), 'matoo-pw-e2e.db');

// seed 账号 table（apps/api/prisma/seed.ts 固定 phone → role；无 email/passwordHash，
// 3 角色登录唯一通道 = OTP UI 流）
export const SEED = {
  admin: '+8801000000001',
  customer: '+8801000000002',
  dealer: '+8801000000003',
} as const;

// 直读测试库拿最新未消费 OTP（与 api e2e readLatestOtp 同款手法：node:sqlite）
// @ts-ignore — node:sqlite 是 Node 22+ 内置，@types/node@20 无类型声明（api seed.ts 同款处理）
export function readLatestOtp(phone: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (p: string) => {
      prepare(sql: string): { get(...args: unknown[]): unknown };
      close(): void;
    };
  };
  const db = new DatabaseSync(TEST_DB);
  try {
    const row = db
      .prepare('SELECT code FROM OtpRequest WHERE phone = ? AND consumedAt IS NULL ORDER BY createdAt DESC LIMIT 1')
      .get(phone) as { code?: string } | undefined;
    return row?.code ?? '';
  } finally {
    db.close();
  }
}

// OTP UI 登录：填号 → 点发送 → 等 code 落库 → 填满 6 位（auth 页自动提交）→ 落地 next
export async function loginByOtp(page: Page, phone: string, next = '/home') {
  // 首访 onboarding 弹窗（localStorage matoo.onboarded 门控）会拦截交互：注入标记跳过
  await page.addInitScript(() => window.localStorage.setItem('matoo.onboarded', '1'));
  await page.goto(`/auth?next=${next}`);
  await page.locator('#auth-phone').fill(phone);
  // 发送按钮 = #auth-code 同 div 相邻 button（i18n 文案双语言，不用文本定位）
  await page.locator('#auth-code').locator('xpath=following-sibling::button').click();
  await expect
    .poll(() => readLatestOtp(phone), { timeout: 15_000, message: `等待 OTP 落库: ${phone}` })
    .not.toBe('');
  await page.locator('#auth-code').fill(readLatestOtp(phone));
  await page.waitForURL(`**${next}`);
}
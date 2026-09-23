// v1.3 P0 e2e:admin SKU 4 Tab + 文档上传 + QR 批量 + 公开扫码页
// 复用 helpers.ts 的 OTP 登录与 SEED 账号表
import { expect, test } from '@playwright/test';
import { loginByOtp, SEED } from './helpers';

// 截图基线:跨 OS 字体渲染像素不一致,CI 跑断言 + 本地 --update-snapshots 管视觉基线
const SNAP = !process.env.CI;

test.describe('v1.3 P0 admin SKU 4 Tab + 扫码联动', () => {
  test('F8 admin → /admin/sku 看到 4 Tab', async ({ page }) => {
    await loginByOtp(page, SEED.admin, '/home');
    await page.goto('/admin/sku');
    // 4 Tab 渲染(默认 i18n 中文)
    await expect(page.getByRole('button', { name: 'SKU 列表' })).toBeVisible();
    await expect(page.getByRole('button', { name: '批次管理' })).toBeVisible();
    await expect(page.getByRole('button', { name: '文档管理' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'QR 批量' })).toBeVisible();
    if (SNAP) await expect(page).toHaveScreenshot('F8-admin-sku-tabs.png', { animations: 'disabled' });
  });

  test('F9 admin → /admin/sku 切批次 Tab → 看到「+ 新建批次」', async ({ page }) => {
    await loginByOtp(page, SEED.admin, '/home');
    await page.goto('/admin/sku');
    await page.getByRole('button', { name: '批次管理' }).click();
    await expect(page.getByRole('button', { name: /\+ 新建批次/ })).toBeVisible();
  });

  test('F10 admin → 文档 Tab 看到「+ 上传文档」按钮', async ({ page }) => {
    await loginByOtp(page, SEED.admin, '/home');
    await page.goto('/admin/sku');
    await page.getByRole('button', { name: '文档管理' }).click();
    await expect(page.getByRole('button', { name: /\+ 上传文档/ })).toBeVisible();
  });

  test('F11 admin → QR Tab 看到「+ 新建 QR 任务」按钮', async ({ page }) => {
    await loginByOtp(page, SEED.admin, '/home');
    await page.goto('/admin/sku');
    await page.getByRole('button', { name: 'QR 批量' }).click();
    await expect(page.getByRole('button', { name: /\+ 新建 QR 任务/ })).toBeVisible();
  });

  test('F12 customer → /scan/[id] 看到正品已验证 + 真实文档卡片(或 unavailable)', async ({ page }) => {
    // 不登录:扫码落地页是公开的
    await page.addInitScript(() => window.localStorage.setItem('matoo.onboarded', '1'));
    await page.goto('/scan/MATO-MAT12200-DEMO0002');
    // 验签通过 + 设备未激活(首次扫码文案)
    await expect(page.getByText('正品已验证')).toBeVisible();
    // 说明书 / 视频卡片标题(挂载阶段可能是「该语言暂无…」,都允许)
    const hasManual = await page.getByText(/用户手册|User Manual|该语言暂无说明书/).first().isVisible().catch(() => false);
    expect(hasManual).toBeTruthy();
    if (SNAP) await expect(page).toHaveScreenshot('F12-scan-public-doc.png', { animations: 'disabled' });
  });
});
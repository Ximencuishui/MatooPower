import { expect, test } from '@playwright/test';
import { loginByOtp, SEED } from './helpers';

// 截图基线仅本地回放：Chromium 字体渲染跨 OS（Windows 本地 / Ubuntu CI）像素不一致，
// CI 跑功能断言（跳过截图），本地 --update-snapshots 管理视觉回归基线
const SNAP = !process.env.CI;

test.describe('T4 核心流程 E2E（双服务真实联通：web 3100 → api 3101 → 临时 seed 库）', () => {
  test('F1 customer OTP 登录 → 首页（欢迎 + 我的设备卡片）', async ({ page }) => {
    await loginByOtp(page, SEED.customer, '/home');
    await expect(page.getByText('欢迎使用 Matoo Power')).toBeVisible();
    // TabBar 也有同名 tab → 用 heading 精确定位节标题
    await expect(page.getByRole('heading', { name: '我的设备' })).toBeVisible();
    // seed 设备 DEMO0002 属 customer → 首页出现序列号卡片
    await expect(page.getByText('SN24B0801A0002')).toBeVisible();
    // animations:disabled 让 SparkLine 停在静止帧，避免子像素动画导致截图像素差异
    if (SNAP) await expect(page).toHaveScreenshot('F1-home-customer.png', { animations: 'disabled' });
  });

  test('F2 扫码 → 激活全链路（DEMO0001 未激活）→ 电子保修卡', async ({ page }) => {
    await loginByOtp(page, SEED.customer, '/home');
    await page.goto('/scan/MATO-MAT12200-DEMO0001');
    await expect(page.getByText('正品已验证')).toBeVisible();
    await expect(page.getByText('首次扫码，设备尚未激活')).toBeVisible();
    await page.getByRole('link', { name: '激活保修' }).click();
    await page.waitForURL('**/activate/**');

    // step 1/3：购买信息（city 必填，无 city 下一步 disabled）
    await page.locator('#act-city').fill('Dhaka');
    await page.locator('#act-dealer').fill('Matoo E2E Dealer');
    await page.getByRole('button', { name: '下一步' }).click();

    // step 2/3：发票（默认有发票分支）
    await page.locator('#act-invoice-no').fill('INV-E2E-0001');
    await page.locator('#act-invoice-date').fill('2026-09-01');
    await page.locator('#act-invoice-amt').fill('76800');
    await page.getByRole('button', { name: '下一步' }).click();

    // step 3/3：确认 → 提交（前端 401 守卫：必须已登录）
    await page.getByRole('button', { name: '提交激活' }).click();
    await page.waitForURL('**/warranty/**');
    // Next.js route announcer 会复制页面标题到 #__next-route-announcer__ → 文本断言有歧义，
    // 用 heading role 精确定位 TopBar 标题
    await expect(page.getByRole('heading', { name: '电子保修卡' })).toBeVisible();
    // 保修卡上有 DEMO0001 的序列号（激活对象）
    await expect(page.getByText('SN24B0801A0001')).toBeVisible();
    if (SNAP) await expect(page).toHaveScreenshot('F2-warranty-activated.png', { animations: 'disabled' });
  });

  test('F3 设备列表 → 详情（dev-1 sparkline 页）', async ({ page }) => {
    await loginByOtp(page, SEED.customer, '/home');
    await page.goto('/devices');
    await expect(page.getByText('SN24B0801A0002')).toBeVisible();
    await page.getByRole('link', { name: /SN24B0801A0002/ }).click();
    await page.waitForURL('**/device/dev-1');
    await expect(page.getByRole('heading', { name: '设备详情' })).toBeVisible();
    // seed dev-1：soh 98（渲染为 "98 %"）/ fw v1.2.4
    await expect(page.getByText('98 %')).toBeVisible();
    await expect(page.getByText('v1.2.4')).toBeVisible();
    // animations:disabled 让 SparkLine 停在静止帧 + 2% 像素阈值容忍字体抗锯齿/SVG 路径抖动
    if (SNAP) await expect(page).toHaveScreenshot('F3-device-dev1.png', { animations: 'disabled', maxDiffPixelRatio: 0.02 });
  });

  test('F4 提交工单 → 详情页 → 我的工单列表出现新单', async ({ page }) => {
    await loginByOtp(page, SEED.customer, '/home');
    await page.goto('/tickets/new');
    await page.locator('#t-subject').fill('E2E 验证工单-电池续航');
    await page.locator('#t-desc').fill('这是 Playwright 端到端流程验证创建的问题描述。');
    await page.getByRole('button', { name: '提交工单' }).click();
    await page.waitForURL('**/tickets/**');
    // route announcer 复制标题 → heading role 精确定位
    await expect(page.getByRole('heading', { name: '工单详情' })).toBeVisible();
    // 回列表，新工单出现
    await page.goto('/tickets');
    await expect(page.getByText('E2E 验证工单-电池续航')).toBeVisible();
  });

  test('F5a admin 可访问运营概览（QuickLink 渲染）', async ({ page }) => {
    await loginByOtp(page, SEED.admin, '/home');
    await page.goto('/admin/overview');
    await expect(page.getByText('403 · 无权访问')).not.toBeVisible();
    // QuickLink label 为硬编码中文（非 i18n），跨语言稳定
    await expect(page.getByRole('link', { name: '用户管理' })).toBeVisible();
    if (SNAP) await expect(page).toHaveScreenshot('F5a-admin-overview.png', { animations: 'disabled' });
  });

  test('F5b customer 访问 admin → 403 卡片', async ({ page }) => {
    await loginByOtp(page, SEED.customer, '/home');
    await page.goto('/admin/overview');
    await expect(page.getByText('403 · 无权访问')).toBeVisible();
    await expect(page.getByText(/不允许访问此页面/)).toBeVisible();
  });

  test('F5c dealer 访问 admin → 403 卡片', async ({ page }) => {
    await loginByOtp(page, SEED.dealer, '/home');
    await page.goto('/admin/overview');
    await expect(page.getByText('403 · 无权访问')).toBeVisible();
  });
});
import { test, expect, request as pwRequest } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Sprint 12 驗收條件 12.1、12.2：隱私權政策與服務條款公開可看；註冊必須勾選同意（伺服器也強制）。

const API = 'http://localhost:3001';

for (const [path, title] of [['/privacy', '隱私權政策'], ['/terms', '服務條款']]) {
  test(`${path} 不需登入就能開，內容完整、無嚴重無障礙問題`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible({ timeout: 20000 });
    // 目前政策還是草稿（經營者與聯絡信箱待填）：標記要在，待填欄位要醒目——不能偽裝成正式文件。
    await expect(page.getByRole('note')).toContainText('草稿');
    await expect(page.getByText(/【待填：/).first()).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(title));
    // 頁尾有兩份文件的連結。
    await expect(page.getByRole('link', { name: '隱私權政策' }).last()).toBeVisible();
    await expect(page.getByRole('link', { name: '服務條款' }).last()).toBeVisible();

    const scan = await new AxeBuilder({ page }).analyze();
    const critical = scan.violations.filter((v) => v.impact === 'critical');
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });
}

test('隱私權政策揭露 AI 小幫手傳送內容與他評匿名的範圍', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: '五、第三方服務' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('OpenRouter', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('可辨識評分者的身分').first()).toBeVisible();
});

test('註冊要先勾選同意：沒勾選會說明原因；勾選後才能建立帳號', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '登入平台' }).first().click({ timeout: 20000 });
  await page.getByRole('tab', { name: '註冊' }).click();
  await page.getByPlaceholder('您的姓名').fill('E2E 同意測試');
  await page.getByPlaceholder('you@example.com').fill(`e2e-consent-${Date.now()}@example.com`);
  await page.getByPlaceholder('至少 8 碼').fill('abcdef12');

  await page.getByRole('button', { name: /建立帳號/ }).click();
  await expect(page.getByRole('alert')).toContainText('請先勾選');
  await expect(page.getByRole('heading', { name: '選擇評量' })).toHaveCount(0);

  // 勾選框旁的連結另開分頁，不會把正在填的表單弄丟。
  const link = page.getByRole('link', { name: '隱私權政策' }).first();
  await expect(link).toHaveAttribute('target', '_blank');

  await page.getByRole('checkbox', { name: /隱私權政策/ }).check();
  await page.getByRole('button', { name: /建立帳號/ }).click();
  await expect(page.getByRole('heading', { name: '選擇評量' })).toBeVisible({ timeout: 20000 });
});

test('伺服器端強制：直接打註冊 API 沒帶同意會被拒絕；帶了才成功並記下版本', async () => {
  const api = await pwRequest.newContext({ baseURL: API });
  const email = `e2e-consent-api-${Date.now()}@example.com`;
  const denied = await api.post('/api/auth/register', { data: { name: '沒同意', email, password: 'abcdef12' } });
  expect(denied.status()).toBe(400);
  expect((await denied.json()).code).toBe('CONSENT_REQUIRED');

  const ok = await api.post('/api/auth/register', { data: { name: '有同意', email, password: 'abcdef12', acceptPolicy: true } });
  expect(ok.status()).toBe(201);
  const body = await ok.json();
  expect(body.user.consent.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await api.dispose();
});

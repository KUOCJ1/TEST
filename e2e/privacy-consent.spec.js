import { test, expect, request as pwRequest } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers.js';
import { buildResult } from '../src/survey/utils/scoring.js';
import { getAssessment } from '../src/survey/data/assessments/index.js';
import { POLICY_META } from '../src/survey/legal/policy.js';

// Sprint 12 驗收條件 12.1、12.2：隱私權政策與服務條款公開可看；註冊必須勾選同意（伺服器也強制）。

const API = 'http://localhost:3001';

for (const [path, title] of [['/privacy', '隱私權政策'], ['/terms', '服務條款']]) {
  test(`${path} 不需登入就能開，內容完整、無嚴重無障礙問題`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible({ timeout: 20000 });
    // 已公開（2026-10-17）：沒有草稿標記、沒有「待填」，經營者與聯絡信箱出現在內文。
    await expect(page.getByRole('note')).toHaveCount(0);
    await expect(page.getByText(/【待填：/)).toHaveCount(0);
    await expect(page.getByText(POLICY_META.operatorName).first()).toBeVisible();
    await expect(page.getByText(POLICY_META.contactEmail).first()).toBeVisible();
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

test('匯入（沒有同意紀錄）的既有用戶首次登入先看到同意畫面：不同意可登出，同意後才進系統', async ({ page }) => {
  // 管理者批次匯入的帳號沒有同意紀錄；用重設連結設好密碼後第一次登入就是「既有用戶補同意」的情境。
  const stamp = Date.now();
  const email = `e2e-imported-${stamp}@example.com`;
  const ai = getAssessment('ai-competency');
  const admin = await pwRequest.newContext({ baseURL: API });
  expect((await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } })).ok()).toBeTruthy();
  const imported = await admin.post('/api/admin/batch-import', {
    data: {
      assessmentId: 'ai-competency',
      rows: [{
        rateeEmail: email, rateeName: 'E2E 匯入學員', raterType: 'self',
        answers: Object.fromEntries(ai.ALL_QUESTIONS.map((q) => [q.id, 3])),
        result: buildResult(Object.fromEntries(ai.ALL_QUESTIONS.map((q) => [q.id, 3])), ai),
      }],
    },
  });
  expect((await imported.json()).usersCreated).toBe(1);
  const overview = await (await admin.get('/api/admin/overview')).json();
  const user = overview.users.find((u) => u.email === email);
  expect(user.consent).toBeNull();
  const { token } = await (await admin.post(`/api/admin/users/${user.id}/reset-token`)).json();
  const anon = await pwRequest.newContext({ baseURL: API });
  expect((await anon.post('/api/auth/reset-password', { data: { token, newPassword: 'abcdef12' } })).ok()).toBeTruthy();

  // 第一次登入：只看到同意畫面，看不到系統。
  await page.goto('/');
  await login(page, email, 'abcdef12', { acceptConsent: false });
  await expect(page.getByRole('heading', { name: /請閱讀並同意隱私權政策與服務條款/ })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(POLICY_META.operatorName).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '選擇評量' })).toHaveCount(0);
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);

  // 不同意 → 登出回到登入頁；再登入還是會被詢問。
  await page.getByRole('button', { name: '不同意，登出' }).click();
  await login(page, email, 'abcdef12', { fromLanding: false, acceptConsent: false });
  await expect(page.getByRole('button', { name: '我同意並繼續' })).toBeVisible({ timeout: 20000 });

  // 同意 → 進入系統；之後重新整理不會再被詢問，而且帳號上有同意紀錄。
  await page.getByRole('button', { name: '我同意並繼續' }).click();
  await expect(page.getByRole('heading', { name: '選擇評量' })).toBeVisible({ timeout: 20000 });
  await page.reload();
  await expect(page.getByRole('heading', { name: '選擇評量' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: '我同意並繼續' })).toHaveCount(0);
  const after = await (await admin.get('/api/admin/overview')).json();
  expect(after.users.find((u) => u.email === email).consent.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await admin.dispose();
  await anon.dispose();
});

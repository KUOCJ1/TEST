import { test, expect, request as pwRequest } from '@playwright/test';
import { register, acceptConsentIfAsked } from './helpers.js';

// 站內與信件裡的入口連結（Sprint 32）：每一種「別人點得到」的網址都要落在正確的畫面。
// 新增任何入口（信件連結、分享連結、導覽項目）時，請在這裡補一條。
// 信件連結來源：server/src/lib/notifications.js（/、/learning）、mailer.js、memberInvites.js（?invite=）、
// 班級報到（?join=）、30／60 天追蹤（?followup=）、重設密碼（?reset=）。

const API = 'http://localhost:3001';
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

const PUBLIC = [
  ['/welcome', /看清落點/],
  ['/about', /./],
  ['/how-it-works', /./],
  ['/showcase', /./],
  ['/faq', /./],
  ['/privacy', /隱私權政策/],
  ['/terms', /服務條款/],
  ['/framework', /./],
  ['/guide/ai-competency', /./],
];

for (const [name, viewport] of [['手機', MOBILE], ['桌機', DESKTOP]]) {
  test(`${name}：公開頁網址都能直接開，不白屏、沒有主控台錯誤`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const [path, text] of PUBLIC) {
      await page.goto(path);
      await expect(page.locator('body')).toContainText(text, { timeout: 15000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} 水平溢出`).toBeLessThanOrEqual(0);
    }
    expect(errors, errors.join('\n')).toHaveLength(0);
    await ctx.close();
  });
}

test('登入後的深層網址（含信件裡的 /learning）重新整理也能直接開；未登入會先到登入', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  // 未登入開 /learning：不是白屏，會看到登入或首頁入口。
  await page.goto('/learning');
  await expect(page.getByRole('button', { name: /登入平台|登入帳號/ }).first()).toBeVisible({ timeout: 20000 });

  await page.goto('/');
  await register(page, '連結測試', `e2e-links-${Date.now()}@example.com`, 'abcdef12');
  await acceptConsentIfAsked(page);
  await expect(page.getByRole('heading', { name: '選擇評量' })).toBeVisible({ timeout: 20000 });

  const deep = [
    ['/learning', '我的學習'],
    ['/analysis', '尚無評測紀錄|我的能力分析'],
    ['/360', '360'],
    ['/profile', '個人設定|帳號'],
    ['/survey/ai-competency', 'AI'],
  ];
  for (const [path, text] of deep) {
    await page.goto(path);
    await page.reload();
    await expect(page.locator('main').first()).toContainText(new RegExp(text), { timeout: 20000 });
    // 每個登入後的畫面要有且只有一個主要內容區（螢幕閱讀器的跳轉點）。
    await expect(page.locator('main'), `${path} 的 main`).toHaveCount(1);
  }
  // 不存在的網址：回到有內容的畫面（不是白屏）。
  await page.goto('/this-page-does-not-exist');
  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page.getByRole('button', { name: /的帳號選單/ })).toBeVisible({ timeout: 15000 });
  await ctx.close();
});

test('班級報到連結 ?join= 與邀請連結 ?invite= 顯示對應班級；無效代碼不白屏', async ({ browser }) => {
  const admin = await pwRequest.newContext({ baseURL: API });
  const ok = async (r, l) => { expect(r.ok(), `${l}: ${r.status()} ${await r.text()}`).toBeTruthy(); return r.json(); };
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin');
  await ok(await admin.post('/api/auth/consent', { data: { accept: true } }), 'consent').catch(() => {});
  const sfx = Date.now();
  const { group } = await ok(await admin.post('/api/coach/groups', { data: { name: `連結班 ${sfx}`, companyName: '連結公司', assessmentId: 'ai-competency' } }), 'group');
  const { group: g } = await ok(await admin.post(`/api/coach/groups/${group.id}/join-code`), 'join code');
  const r = await ok(await admin.post(`/api/coach/groups/${group.id}/roster`, { data: { entries: [{ email: `e2e-invite-${sfx}@example.com`, name: '受邀者' }] } }), 'roster');
  const code = (r.memberInvites ?? []).find((m) => m.email === `e2e-invite-${sfx}@example.com`)?.code;
  expect(code).toBeTruthy();

  for (const viewport of [MOBILE, DESKTOP]) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    await page.goto(`/?join=${g.joinCode}`);
    await expect(page.getByText(`連結班 ${sfx}`)).toBeVisible({ timeout: 20000 });
    await page.goto(`/?invite=${code}`);
    await expect(page.getByText(`連結班 ${sfx}`)).toBeVisible({ timeout: 20000 });
    await expect(page.getByPlaceholder('you@example.com')).toHaveValue(`e2e-invite-${sfx}@example.com`);
    await page.goto('/?join=NOTACODE');
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible({ timeout: 20000 });
    await page.goto('/?invite=NOTACODE0');
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible({ timeout: 20000 });
    await ctx.close();
  }
  await admin.dispose();
});

test('推廣連結 /start：直接到註冊畫面；註冊後是試用帳號（只看得到 AI 職能與 DISC，360° 顯示鎖定說明）', async ({ browser }) => {
  for (const viewport of [MOBILE, DESKTOP]) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    await page.goto('/start');
    await expect(page.getByText('免費試用')).toBeVisible({ timeout: 20000 });
    await page.getByPlaceholder('您的姓名').fill('試用者');
    await page.getByPlaceholder('you@example.com').fill(`e2e-trial-${Date.now()}-${viewport.width}@example.com`);
    await page.getByPlaceholder('至少 8 碼').fill('abcdef12');
    await page.getByRole('checkbox', { name: /隱私權政策/ }).check();
    await page.getByRole('button', { name: /建立帳號/ }).click();
    await acceptConsentIfAsked(page);
    await expect(page.getByRole('heading', { name: '選擇評量' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/點驗證連結/)).toBeVisible();
    const main = page.locator('main').first();
    await expect(main).toContainText('DISC');
    await expect(main).not.toContainText('九大構面');
    await page.goto('/360');
    await expect(page.getByRole('region', { name: /360° 多元評測（試用帳號未開放）/ })).toBeVisible({ timeout: 20000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await ctx.close();
  }
});

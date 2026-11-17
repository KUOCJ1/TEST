import { test, expect, request as pwRequest } from '@playwright/test';
import fs from 'fs';

// 學員成長旅程走查：用手機尺寸，從掃碼入班到複測，一步一張截圖（第一屏），給人逐張看「順不順」。
// 不是會擋部署的測試；種子資料全是虛構的示範姓名與 example.com 信箱。
const API = 'http://localhost:3001';
const OUT = process.env.JOURNEY_OUT || 'journey-out';
fs.mkdirSync(OUT, { recursive: true });
const MOBILE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const ok = async (res, label) => { expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy(); return res.json(); };
let n = 0;
const notes = [];
async function shot(page, name, note = '') {
  n += 1;
  await page.waitForTimeout(500);
  const file = `${String(n).padStart(2, '0')}-${name}`;
  await page.screenshot({ path: `${OUT}/${file}.jpg`, type: 'jpeg', quality: 60 });
  const m = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, buttons: [...document.querySelectorAll('main button, main a[href]')].filter((b) => b.getBoundingClientRect().top < window.innerHeight && b.getBoundingClientRect().bottom > 0).map((b) => (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 20)).filter(Boolean) }));
  notes.push({ file, note, pageHeight: m.h, firstScreenActions: m.buttons });
  fs.writeFileSync(`${OUT}/notes.json`, JSON.stringify(notes, null, 1));
}
const step = async (label, fn) => { try { await fn(); } catch (e) { notes.push({ file: `ERROR ${label}`, note: String(e.message).split('\n')[0].slice(0, 200) }); fs.writeFileSync(`${OUT}/notes.json`, JSON.stringify(notes, null, 1)); } };

test('學員成長旅程', async ({ browser }) => {
  const sfx = Date.now();
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin');
  const coach = await pwRequest.newContext({ baseURL: API });
  const reg = await ok(await coach.post('/api/auth/register', { data: { acceptPolicy: true, name: '林教練', email: `j-coach-${sfx}@example.com`, password: 'abcdef12' } }), 'coach');
  await ok(await admin.patch(`/api/admin/users/${reg.user.id}/role`, { data: { role: 'coach' } }), 'promote');
  await ok(await coach.post('/api/auth/login', { data: { email: `j-coach-${sfx}@example.com`, password: 'abcdef12' } }), 'coach login');
  const { group } = await ok(await coach.post('/api/coach/groups', { data: { name: '主管領導力班 第 3 梯', companyName: '示範股份有限公司', assessmentId: 'leadership-9d' } }), 'group');
  const { group: g } = await ok(await coach.post(`/api/coach/groups/${group.id}/join-code`), 'code');

  const ctx = await browser.newContext(MOBILE);
  const p = await ctx.newPage();

  // 1. 掃 QR 進來
  await step('join', async () => {
    await p.goto(`/?join=${g.joinCode}`);
    await p.getByPlaceholder('you@example.com').waitFor({ timeout: 20000 });
    await shot(p, 'qr-landing', '掃 QR 進來的第一屏');
    await p.getByRole('tab', { name: '註冊' }).click();
    await p.getByPlaceholder('您的姓名').fill('陳小明');
    await p.getByPlaceholder('you@example.com').fill(`j-learner-${sfx}@example.com`);
    await p.getByPlaceholder('至少 8 碼').fill('abcdef12');
    await p.getByRole('checkbox', { name: /隱私權政策/ }).check();
    await p.getByRole('button', { name: /建立帳號/ }).click();
    await p.waitForTimeout(2500);
    await shot(p, 'after-register', '註冊後落在哪裡');
  });

  // 2. 作答（全部點第 4 格，執行力相關題點低一點）
  await step('survey', async () => {
    if (!(await p.locator('fieldset[data-question-id]').first().isVisible().catch(() => false))) {
      await p.goto('/survey/leadership-9d');
    }
    await p.waitForSelector('fieldset[data-question-id]', { timeout: 20000 });
    await shot(p, 'survey-start', '作答第一屏');
    // 題目分段：每段作答後按「下一段」，直到出現「送出評測」。
    let answered = 0;
    let segments = 0;
    for (let guard = 0; guard < 30; guard++) {
      segments += 1;
      const sets = p.locator('fieldset[data-question-id]:visible');
      const count = await sets.count();
      for (let i = 0; i < count; i++) { await sets.nth(i).locator('label').nth((answered + i) % 7 === 0 ? 1 : 3).click(); }
      answered += count;
      if (segments === 2) await shot(p, 'survey-segment-2', '作答第 2 段');
      const submit = p.getByRole('button', { name: /送出評測/ });
      if (await submit.isVisible().catch(() => false)) break;
      await p.getByRole('button', { name: /^下一段/ }).first().click();
      await p.waitForTimeout(300);
    }
    await shot(p, 'survey-end', `作答完畢（${answered} 題、${segments} 段）`);
    await p.getByRole('button', { name: /送出評測/ }).click();
    await expect(p.getByText('您的總得分')).toBeVisible({ timeout: 20000 });
    await p.evaluate(() => window.scrollTo(0, 0));
    await shot(p, 'result-top', '結果頁第一屏');
  });

  // 3. 結果頁往下：一分鐘版、選一件事、微練習
  await step('result-scroll', async () => {
    for (const [name, region] of [['result-oneminute', '一分鐘看懂'], ['result-first-action', null], ['result-practice', '四週微練習']]) {
      if (region) await p.getByRole('region', { name: region }).scrollIntoViewIfNeeded();
      else await p.getByRole('button', { name: '就做這件事' }).scrollIntoViewIfNeeded();
      await shot(p, name);
    }
    await p.getByRole('button', { name: '就做這件事' }).click();
    await p.waitForTimeout(800);
    await shot(p, 'after-first-action', '按了「就做這件事」');
    await p.getByRole('button', { name: '開始四週微練習' }).click();
    await p.waitForTimeout(800);
    await shot(p, 'after-practice-start', '按了「開始四週微練習」');
  });

  // 4. 回首頁
  await step('home', async () => {
    await p.goto('/home');
    await p.waitForTimeout(1500);
    await shot(p, 'home-after-day1', '評測完、設了目標與微練習之後的首頁');
    await p.evaluate(() => window.scrollTo(0, 700));
    await shot(p, 'home-scrolled');
  });

  // 5. 教練：寫評語、建一對一會談
  const learnerId = (await (await p.request.get('/api/auth/me')).json()).user.id;
  await step('coach', async () => {
    const detail = await ok(await coach.get(`/api/coach/groups/${group.id}`), 'detail');
    const sub = detail.submissions.find((s) => s.userId === learnerId);
    await ok(await coach.post(`/api/submissions/${sub.id}/comment`, { data: { text: '你的溝通與建立關係很穩，團隊信任你。執行節奏是下一步：把大目標拆成兩週可完成的小步。', tips: ['每週一寫下本週三件最重要的事', '週五花 10 分鐘回顧'] } }), 'comment');
    await ok(await coach.post(`/api/coach/groups/${group.id}/sessions`, { data: { type: 'one-on-one', title: '一對一：執行節奏', focus: '延續報告的執行力，談怎麼把目標拆小', sessionDate: new Date().toISOString(), participantIds: [learnerId] } }), 'session');
  });

  // 6. 學員：首頁 → 反思
  await step('reflection', async () => {
    await p.goto('/home');
    await p.waitForTimeout(1500);
    await shot(p, 'home-with-reflection', '教練評語與會談之後的首頁');
    await p.goto('/learning');
    await p.waitForTimeout(1500);
    await shot(p, 'learning-top', '我的學習第一屏');
    const panel = p.getByRole('region', { name: '會後反思' });
    await panel.getByLabel(/最大的收穫/).fill('我一直想一次做完，所以遲遲不開始');
    await panel.getByLabel(/一個行動/).fill('每週一寫下三件最重要的事，週五回顧');
    await panel.getByRole('radio', { name: '5' }).check({ force: true });
    await panel.getByRole('checkbox', { name: /變成我的發展目標/ }).check();
    await panel.getByRole('button', { name: '送出反思' }).click();
    await p.waitForTimeout(800);
    await p.evaluate(() => window.scrollTo(0, 0));
    await shot(p, 'learning-after-reflection', '交完反思之後的我的學習');
    await p.evaluate(() => window.scrollTo(0, 1400));
    await shot(p, 'learning-goals', '目標區');
    await p.evaluate(() => window.scrollTo(0, 2600));
    await shot(p, 'learning-goals-2');
  });

  // 7. 一週後：回報、微練習第 2 週（把時間往前撥）
  await step('week2', async () => {
    const goals = await ok(await p.request.get('/api/goals'), 'goals');
    await ok(await admin.get('/api/health'), 'h');
    // 直接改不了伺服器時間：用 API 把目標建立時間與微練習開始時間往回撥是做不到的，這裡只看「回報」的入口
    await p.goto('/home');
    await p.waitForTimeout(1200);
    await shot(p, 'home-week1-again', `一週內再回來的首頁（目標 ${goals.goals.length} 個）`);
    await p.goto('/analysis');
    await p.waitForTimeout(1500);
    await shot(p, 'analysis-top', '我的分析第一屏');
  });

  await ctx.close();
});

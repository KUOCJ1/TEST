import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { register, login } from './helpers.js';

// 黃金路徑 3／3（Sprint 5 驗收條件 5.2）：管理者停用一個題庫後，學員在
// 「選擇評量」看不到它；重新啟用後又看得到。

test('管理者停用題庫後，學員看不到該評量；重新啟用後恢復', async ({ page, browser }) => {
  const assessmentName = 'AI 全方位職能實戰課前評測';

  await page.goto('/');
  await login(page, 'admin@e2e.test', 'E2eTest1234');
  await expect(page.getByText('管理後台')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: '管理後台' }).click();
  await page.waitForSelector('text=題庫啟用狀態', { timeout: 10000 });

  // 無障礙檢查：管理後台（含 Sprint 3 新增的延伸閱讀使用情形面板）。
  const adminScan = await new AxeBuilder({ page }).analyze();
  const adminCritical = adminScan.violations.filter((v) => v.impact === 'critical');
  expect(adminCritical, JSON.stringify(adminCritical, null, 2)).toHaveLength(0);

  // 「AI 全方位職能實戰課前評測」這個名字同時也出現在「數據分析」分頁的題庫
  // 篩選按鈕列（AdminDashboard 預設分頁），一定要先把範圍限定在「題庫啟用狀態」
  // 這個 section 裡面，才不會抓到篩選列上同名的那顆按鈕。
  const section = page.locator('section', { has: page.getByText('題庫啟用狀態') });
  const row = section.locator('div', { has: page.getByText(assessmentName, { exact: true }) }).last();
  const toggleBtn = row.getByRole('button');
  await expect(toggleBtn).toHaveText('啟用中', { timeout: 10000 });

  // 停用。
  await toggleBtn.click();
  await expect(toggleBtn).toHaveText('已停用', { timeout: 10000 });

  // 全新學員登入後，「選擇評量」看不到這個題庫。用全新的瀏覽器 context（不是
  // context.newPage()）——同一個 context 底下開新分頁會共用 cookie，這個分頁
  // 會直接繼承管理員的登入 session，而不是真的模擬一個全新使用者。
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  const email = `e2e-toggle-student-${Date.now()}@example.com`;
  await studentPage.goto('/');
  await register(studentPage, 'E2E 學員（停用測試）', email, 'abcdef12');
  await expect(studentPage.getByRole('heading', { name: '選擇評量' })).toBeVisible({ timeout: 15000 });
  await expect(studentPage.getByText(assessmentName)).not.toBeVisible();
  await studentContext.close();

  // 重新啟用，回到乾淨狀態。
  await toggleBtn.click();
  await expect(toggleBtn).toHaveText('啟用中', { timeout: 10000 });
});

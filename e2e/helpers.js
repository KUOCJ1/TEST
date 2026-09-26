// 共用的登入／註冊流程，供 e2e/*.spec.js 共用。
//
// `fromLanding` 由呼叫端明確指定，而不是用「探測『登入平台』按鈕存不存在」來
// 自動判斷：探測法在 Vite dev server 冷啟動（第一次請求要即時轉譯一堆模組，
// 明顯比之後的請求慢）時很容易誤判——`isVisible()` 是立即檢查、不會等待，
// 冷啟動當下畫面還沒渲染出來就會直接回傳 false；改用會重試的 `waitFor()`
// 又會讓「這次真的不會出現這顆按鈕」的情況（例如登出後同一頁面 view 狀態已經
// 停在登入表單、或帶 join code 直接進站）白白等到逾時。呼叫端本來就知道自己
// 現在是哪種情境，直接說清楚最不容易踩到時間相關的 flaky 測試。

export async function goToLoginForm(page, { fromLanding = true } = {}) {
  if (fromLanding) {
    // 給比較寬裕的逾時：只有這裡（每個測試的「第一次」進站）需要承受 Vite
    // dev server 冷啟動的轉譯時間，後續呼叫都用 fromLanding:false 跳過等待。
    await page.getByRole('button', { name: '登入平台' }).first().click({ timeout: 20000 });
  }
}

export async function login(page, email, password, opts) {
  await goToLoginForm(page, opts);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('至少 8 碼').fill(password);
  await page.getByRole('button', { name: '登入帳號' }).click();
}

export async function register(page, name, email, password, opts) {
  await goToLoginForm(page, opts);
  await page.getByRole('tab', { name: '註冊' }).click();
  await page.getByPlaceholder('您的姓名').fill(name);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('至少 8 碼').fill(password);
  await page.getByRole('button', { name: /建立帳號/ }).click();
}

// 登出收在右上角的帳號選單裡（Sprint 8），先打開選單再點「登出」。
export async function logout(page) {
  await page.getByRole('button', { name: /的帳號選單/ }).click();
  await page.getByRole('menuitem', { name: '登出' }).click();
}

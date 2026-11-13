// 「加到主畫面」安裝引導的判斷邏輯（純函式，方便測試）。
//
// 平台差異：
// - Android／桌面 Chromium：瀏覽器發 `beforeinstallprompt`，留住事件，使用者按「安裝」時呼叫 prompt()。
// - iPhone／iPad 的 Safari：沒有程式化安裝，只能教使用者「分享 → 加入主畫面」。
// - LINE、Facebook、Instagram 等 App 內建瀏覽器：不能安裝，要請使用者改用 Safari／Chrome 開啟。
// 已經從主畫面開啟（standalone）就不再顯示。
import { readJSON, writeJSON } from '../utils/storage.js';

const DISMISS_KEY = 'aiassess_install_dismissed_at'; // 裝置偏好，登出不清除
export const SNOOZE_DAYS = 30;

export function isStandalone(win = window) {
  return Boolean(win.matchMedia?.('(display-mode: standalone)')?.matches || win.navigator?.standalone === true);
}

/** @returns {'ios-safari' | 'ios-other' | 'in-app' | 'android' | 'desktop'} */
export function detectPlatform(ua = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints ?? 0) {
  const inApp = /Line\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger/i.test(ua);
  // iPadOS 13+ 的 UA 會偽裝成 Mac，用觸控點數判斷。
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1);
  if (inApp) return 'in-app';
  if (ios) return /CriOS|FxiOS|EdgiOS/i.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function isSnoozed(now = Date.now()) {
  const at = readJSON(DISMISS_KEY, null);
  return typeof at === 'number' && now - at < SNOOZE_DAYS * 864e5;
}
export function snooze(now = Date.now()) { writeJSON(DISMISS_KEY, now); }

// `beforeinstallprompt` 可能在 React 掛載前就觸發，所以在模組載入時就先接住。
let deferred = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    listeners.forEach((fn) => fn(true));
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((fn) => fn(false));
  });
}
export const hasDeferredPrompt = () => deferred !== null;
export function onDeferredPromptChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
/** 跳出瀏覽器的安裝對話框；回傳使用者是否接受。 */
export async function promptInstall() {
  if (!deferred) return false;
  const ev = deferred;
  deferred = null;
  listeners.forEach((fn) => fn(false));
  await ev.prompt();
  const choice = await ev.userChoice.catch(() => null);
  return choice?.outcome === 'accepted';
}

// 隱私權政策與服務條款的版本（Sprint 12）。
//
// 使用者同意時會把這個版本號連同時間存進他的資料（user.consent）。政策有「實質修改」
// （蒐集的資料、用途、第三方、保存期限等）時調高這個版本，所有人下次登入就會被再詢問一次。
// 只改錯字、不改意思的修訂不用調。
//
// ⚠️ 前端有一份相同的常數：src/survey/legal/policy.js 的 POLICY_VERSION。兩邊必須一致，
// 前端測試（src/test/legal-policy.test.jsx）會讀這個檔案確認，不一致 CI 就會失敗。
export const POLICY_VERSION = '2026-10-16';

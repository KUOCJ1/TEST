// 前端這份打包是哪一版（Sprint 7 驗收條件 7.1）：deploy.sh 建置時以
// VITE_BUILD_COMMIT／VITE_BUILT_AT 環境變數注入，寫死在打包結果裡。
//
// 刻意在建置時寫死，而不是執行時去讀伺服器上的檔案：PWA 的 service worker 會
// 快取整份前端，瀏覽器「實際在跑」的版本可能比伺服器上的舊——只有打包進去的
// 版本號能反映這一點。本機開發沒有注入，為 null。
export const FRONTEND_BUILD = {
  commit: import.meta.env.VITE_BUILD_COMMIT || null,
  builtAt: import.meta.env.VITE_BUILT_AT || null,
};

/** 前後端都有版本號、而且不一樣時為 true（本機開發任一方為 null 時不判定）。 */
export function isVersionMismatch(frontend, backend) {
  return Boolean(frontend?.commit && backend?.commit && frontend.commit !== backend.commit);
}

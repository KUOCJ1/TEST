import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// findBy*/waitFor 預設只等 1 秒。整合測試（app-flow 等）會走到 lazy() 載入的頁面
// （管理後台、我的分析…），整套測試一起跑或在 CI 冷啟動時，編譯這些 chunk 偶爾會
// 超過 1 秒而隨機失敗（Sprint 7、8 各遇過一次）。放寬到 3 秒；正常情況下 findBy
// 一找到就回傳，不會拖慢測試。
configure({ asyncUtilTimeout: 3000 });

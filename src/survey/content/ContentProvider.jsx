import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { applyContentOverrides } from '../data/assessments/overrides';
import LoadingState from '../components/LoadingState';
import { ContentContext } from './useContent';

// 取不到覆寫就用程式碼內建的題庫，不能讓這支小請求卡住整個 App——設個逾時上限。
const LOAD_TIMEOUT_MS = 4000;
const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
]);

/**
 * 載入「已發佈」的題庫內容覆寫並套用到前端題庫設定（Sprint 10）。載入完成前不渲染
 * 子畫面，避免作答頁先閃一下內建文字又換成新文字。
 *
 * `version` 每次套用都 +1，AppShell 拿它當 key，讓已經畫出來的頁面在發佈／預覽／還原後
 * 重新渲染（題庫設定是就地修改的普通物件，React 不會自己知道它變了）。
 */
export function ContentProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const published = useRef({});

  // 用 promise 鏈而不是 async/await：setState 都落在回呼裡，不在 effect 本體同步呼叫
  // （react-hooks/set-state-in-effect）。
  const reload = useCallback(() => withTimeout(Promise.resolve().then(() => api.assessmentContent()), LOAD_TIMEOUT_MS)
    .then(
      (content) => { published.current = content ?? {}; },
      () => { /* 第一次載入失敗＝沒有覆寫；之後重載失敗則維持上一次成功的內容 */ },
    )
    .then(() => {
      applyContentOverrides(published.current);
      setPreviewing(false);
      setVersion((v) => v + 1);
      setReady(true);
    }), []);

  useEffect(() => { reload(); }, [reload]);

  /** 管理者預覽草稿：只在這個分頁的記憶體套用，重新整理或 stopPreview() 即恢復。 */
  const previewDraft = useCallback((assessmentId, overrides) => {
    applyContentOverrides({ ...published.current, [assessmentId]: { overrides } });
    setPreviewing(true);
    setVersion((v) => v + 1);
  }, []);

  const stopPreview = useCallback(() => {
    applyContentOverrides(published.current);
    setPreviewing(false);
    setVersion((v) => v + 1);
  }, []);

  const value = useMemo(
    () => ({ version, previewing, reload, previewDraft, stopPreview }),
    [version, previewing, reload, previewDraft, stopPreview],
  );

  if (!ready) return <LoadingState />;
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

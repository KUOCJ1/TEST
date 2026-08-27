import { createContext, useContext } from 'react';

export const ConfirmContext = createContext(null);

/**
 * 取代 window.confirm()：瀏覽器原生對話框套不上站內視覺樣式、鍵盤操作也不一致。
 * 用法完全比照 window.confirm 的慣用寫法，只多一個 await：
 *   if (!(await confirm('確定要刪除嗎？'))) return;
 * 可傳字串，或帶選項的物件 { title, confirmLabel, cancelLabel, danger }。
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm 必須在 <ConfirmProvider> 內使用');
  return ctx;
}

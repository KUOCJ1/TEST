import { createContext, useContext } from 'react';

export const ContentContext = createContext(null);

/** 題庫內容覆寫的狀態與操作；在 <ContentProvider> 外使用時回傳無操作的預設值（測試／獨立元件用）。 */
export function useContent() {
  return useContext(ContentContext) ?? {
    version: 0, previewing: false, reload: async () => {}, previewDraft: () => {}, stopPreview: () => {},
  };
}

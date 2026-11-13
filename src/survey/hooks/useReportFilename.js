import { useCallback, useEffect } from 'react';
import { detectPlatform, isStandalone } from '../pwa/installPrompt';

/** iPhone／iPad 從主畫面（standalone）開啟時，window.print() 不一定能用。 */
export const IOS_STANDALONE_PRINT_HINT = '從主畫面開啟的 App 在 iPhone 上無法直接列印或存成 PDF。請改用 Safari 開啟這個網站再按一次，或在電腦上開啟報告列印。';
export function printUnsupported() {
  const p = detectPlatform();
  return isStandalone() && (p === 'ios-safari' || p === 'ios-other');
}

/**
 * 報告開啟期間，把頁面標題設成報告檔名（瀏覽器的「另存為 PDF」預設用它當檔名；
 * 從瀏覽器選單或 Ctrl/Cmd+P 列印也一樣）。關閉報告時還原。回傳的 print() 在列印前再設一次，
 * 避免其他程式在報告開著時改掉標題。
 */
export function useReportFilename(filename) {
  useEffect(() => {
    const previous = document.title;
    document.title = filename;
    return () => { document.title = previous; };
  }, [filename]);
  return useCallback(() => {
    document.title = filename;
    if (printUnsupported()) {
      window.alert(IOS_STANDALONE_PRINT_HINT);
      return;
    }
    window.print();
  }, [filename]);
}

import { useCallback, useEffect } from 'react';

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
    window.print();
  }, [filename]);
}

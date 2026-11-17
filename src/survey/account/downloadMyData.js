import { api } from '../api/client';
import { toDateInputValue } from '../utils/format';

/** 下載我的資料：取得 JSON 後存成檔案（全程在瀏覽器裡，不經過第三方）。 */
export async function downloadMyData() {
  const data = await api.exportMyData();
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `my-data-${toDateInputValue(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

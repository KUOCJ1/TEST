import { readSheet } from 'read-excel-file/universal';

// 拆成獨立檔案（不是 BatchUploadSection.jsx 內的函式）有兩個原因：
// 1. React Fast Refresh 只允許一個檔案單純只匯出元件，跟元件放在同一個檔案裡
//    匯出這些純函式會讓 react-refresh/only-export-components 這條 lint 規則失敗。
// 2. 這批解析邏輯是 xlsx 套件遷移（Sprint 5 驗收條件 5.1，見
//    docs/SPRINT_PLAN.md）風險最高的部分，獨立成檔案也比較好直接寫測試
//    （src/test/batch-upload-parsing.test.jsx）。
//
// 選 read-excel-file 而不是先前試過的 exceljs：exceljs 是讀寫都支援的完整套件，
// 內部帶了 archiver／unzipper 這類早已停止維護、又把 lazy chunk 從 354 KB
// 撐到快 1 MB（gzip 後 263 KB）的重依賴；我們只需要「讀」.xlsx，
// read-excel-file 是專門給瀏覽器讀取用的輕量套件（核心解壓縮靠 fflate、XML
// 解析靠 saxen，都是現代、單純目的的小函式庫），`npm audit --omit=dev` 全綠，
// 且改善了 bundle 大小。用 `/universal` 這個 entry（而非 `/browser`）是刻意
// 避開它預設的 Web Worker 路徑——批次匯入是低頻的管理後台操作，不值得為了
// 背景執行緒的效能增加 Vite 打包設定的複雜度。

// 純文字 CSV 解析（支援引號欄位、"" 跳脫引號、逗號、CRLF/LF/CR 換行）——不需要
// 額外套件；.xlsx 才需要真正的 Excel 解析器（見下方 parseXlsxFile）。兩條路徑
// 最後都收斂到同一個 rowsToObjects()，下游 validateAndScore() 不需要分辨來源。
export function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c === '\r') {
      if (text[i + 1] !== '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

export function rowsToObjects(rows) {
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

// read-excel-file 回傳的儲存格值型別是 string / number / boolean / Date /
// null——比 exceljs 單純得多（不會有公式格、富文字格），日期格另外攤平成
// ISO 字串，跟 validateAndScore() 既有的字串/數字處理相容。
function cellText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return value;
}

async function parseXlsxFile(file) {
  const rows = await readSheet(file);
  return rowsToObjects(rows.map((row) => row.map(cellText)));
}

export function parseFile(file) {
  const isCsv = /\.csv$/i.test(file.name);
  if (isCsv) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('檔案讀取失敗'));
      reader.onload = (e) => {
        try {
          resolve(rowsToObjects(parseCsvText(String(e.target.result))));
        } catch {
          reject(new Error('檔案解析失敗，請確認格式正確'));
        }
      };
      reader.readAsText(file);
    });
  }
  return parseXlsxFile(file).catch(() => {
    throw new Error('檔案解析失敗，請確認格式正確（僅支援 .xlsx，不支援舊版 .xls）');
  });
}

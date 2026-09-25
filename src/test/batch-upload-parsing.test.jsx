import { describe, it, expect } from 'vitest';
import writeXlsxFile from 'write-excel-file/node';
import { parseCsvText, rowsToObjects, parseFile } from '../survey/admin/batchFileParsing.js';

describe('parseCsvText', () => {
  it('解析基本的逗號分隔欄位', () => {
    const rows = parseCsvText('a,b,c\r\n1,2,3\r\n');
    expect(rows).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('支援引號欄位內含逗號', () => {
    const rows = parseCsvText('name,note\r\n"王小明","很棒, 表現優異"\r\n');
    expect(rows[1]).toEqual(['王小明', '很棒, 表現優異']);
  });

  it('支援引號內用 "" 跳脫成一個雙引號', () => {
    const rows = parseCsvText('a\r\n"she said ""hi"""\r\n');
    expect(rows[1]).toEqual(['she said "hi"']);
  });

  it('支援純 \\n 換行（不只 CRLF）', () => {
    const rows = parseCsvText('a,b\n1,2\n');
    expect(rows).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('最後一行沒有結尾換行符時仍會被讀到', () => {
    const rows = parseCsvText('a,b\r\n1,2');
    expect(rows).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('rowsToObjects', () => {
  it('把第一列當標題，組成物件陣列', () => {
    const objs = rowsToObjects([['a', 'b'], ['1', '2'], ['3', '4']]);
    expect(objs).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  });

  it('空陣列回傳空陣列', () => {
    expect(rowsToObjects([])).toEqual([]);
  });

  it('資料列比標題短時缺的欄位補空字串（跟舊版 XLSX.utils.sheet_to_json({defval:""}) 行為一致）', () => {
    const objs = rowsToObjects([['a', 'b', 'c'], ['1']]);
    expect(objs).toEqual([{ a: '1', b: '', c: '' }]);
  });
});

// parseFile() 是換掉 xlsx 套件（Sprint 5 驗收條件 5.1）真正的風險所在，直接用
// 真實的 File/FileReader（CSV）與真的 .xlsx 二進位內容（用姊妹套件
// write-excel-file 產生，而不是手刻假資料）走一次完整流程。
describe('parseFile（真實 File，涵蓋 CSV 與 .xlsx 兩條路徑）', () => {
  it('.csv 檔案：正確解析成物件陣列', async () => {
    const csv = 'ratee_email,ratee_name,q1\r\nming@example.com,王小明,5\r\n';
    const file = new File([csv], 'roster.csv', { type: 'text/csv' });
    const rows = await parseFile(file);
    expect(rows).toEqual([{ ratee_email: 'ming@example.com', ratee_name: '王小明', q1: '5' }]);
  });

  it('.xlsx 檔案：用 write-excel-file 真的產生一份 .xlsx 二進位內容，再讀回來驗證', async () => {
    const buffer = await writeXlsxFile([
      ['ratee_email', 'ratee_name', 'rater_type', 'q1', 'q2'],
      ['ming@example.com', '王小明', 'self', 5, 4],
    ]).toBuffer();
    const file = new File([buffer], 'roster.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const rows = await parseFile(file);
    expect(rows).toHaveLength(1);
    expect(rows[0].ratee_email).toBe('ming@example.com');
    expect(rows[0].ratee_name).toBe('王小明');
    expect(rows[0].rater_type).toBe('self');
    expect(rows[0].q1).toBe(5);
    expect(rows[0].q2).toBe(4);
  });

  it('壞掉的 .xlsx 檔案會被拒絕並給出中文錯誤訊息，而不是讓例外往上炸', async () => {
    const file = new File(['not a real xlsx file'], 'broken.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await expect(parseFile(file)).rejects.toThrow(/檔案解析失敗/);
  });
});

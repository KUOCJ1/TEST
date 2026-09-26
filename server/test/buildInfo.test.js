import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readBuildInfo } from '../src/lib/buildInfo.js';

describe('readBuildInfo()（Sprint 7 驗收條件 7.1）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-info-'));
  const write = (name, content) => { const f = path.join(dir, name); fs.writeFileSync(f, content); return f; };

  test('讀出 deploy.sh 寫入的 commit 與建置時間', () => {
    const f = write('ok.json', JSON.stringify({ commit: 'abc1234', builtAt: '2026-09-26T03:00:00Z' }));
    assert.deepEqual(readBuildInfo(f), { commit: 'abc1234', builtAt: '2026-09-26T03:00:00Z' });
  });

  test('檔案不存在（本機開發／測試）時回傳 null，不丟例外', () => {
    assert.deepEqual(readBuildInfo(path.join(dir, 'missing.json')), { commit: null, builtAt: null });
  });

  test('內容毀損或欄位型別不對時回傳 null', () => {
    assert.deepEqual(readBuildInfo(write('bad.json', '{not json')), { commit: null, builtAt: null });
    assert.deepEqual(readBuildInfo(write('wrong.json', JSON.stringify({ commit: 123, builtAt: '' }))), { commit: null, builtAt: null });
  });
});

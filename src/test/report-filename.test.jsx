import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PrintableReport from '../survey/components/PrintableReport.jsx';
import { reportFilename, REPORT_KIND, cleanPart, dateStamp } from '../survey/utils/reportFilename.js';
import { buildResult } from '../survey/utils/scoring.js';
import { getAssessment, REGISTRY } from '../survey/data/assessments/index.js';

const NOW = new Date('2026-11-05T02:00:00Z'); // 台灣 10:00

describe('reportFilename 命名規則', () => {
  it('學員自己的個人報告：簡稱_類型_姓名_日期', () => {
    expect(reportFilename({ kind: REPORT_KIND.personal, assessmentId: 'leadership-9d', subject: '王小明', date: NOW })).toBe('L9D_個人報告_王小明_20261105');
  });
  it('班級內：班級名稱放最前面，同一客戶的檔案排在一起', () => {
    expect(reportFilename({ kind: REPORT_KIND.threeSixty, assessmentId: 'leadership-360-70', groupName: '森永高階教練 360', subject: '潘信諺', date: NOW }))
      .toBe('森永高階教練-360_L8D_360報告_潘信諺_20261105');
    expect(reportFilename({ kind: REPORT_KIND.group, assessmentId: 'leadership-9d', groupName: '測試班', date: NOW })).toBe('測試班_L9D_班級報告_20261105');
    expect(reportFilename({ kind: REPORT_KIND.batch, assessmentId: 'leadership-9d', groupName: '測試班', detail: '12人', date: NOW })).toBe('測試班_L9D_個人報告彙整_12人_20261105');
    expect(reportFilename({ kind: REPORT_KIND.groupDiagnosis, assessmentId: 'leadership-compass', groupName: 'A 班', detail: '課前', date: NOW })).toBe('A-班_LC_班級組織診斷_課前_20261105');
  });
  it('日期用台灣時間：UTC 傍晚已經是隔天', () => {
    expect(dateStamp(new Date('2026-11-05T17:00:00Z'))).toBe('20261106');
    expect(dateStamp(new Date('2026-11-05T15:59:00Z'))).toBe('20261105');
  });
  it('檔名不含檔案系統不允許的字元、空白與過長內容；空值的段落省略', () => {
    expect(cleanPart('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
    expect(cleanPart('  Pauline   Luo ')).toBe('Pauline-Luo');
    expect(cleanPart('x'.repeat(100))).toHaveLength(40);
    expect(cleanPart('..hidden..')).toBe('hidden');
    expect(reportFilename({ kind: REPORT_KIND.personal, assessmentId: 'disc', subject: '', date: NOW })).toBe('DISC_個人報告_20261105');
    const bad = reportFilename({ kind: REPORT_KIND.personal, assessmentId: 'disc', groupName: 'A/B:C', subject: '王*小?明', date: NOW });
    expect(bad).not.toMatch(/[\\/:*?"<>|]/);
  });
  it('每個可列印的評量都有簡稱，不會落到空字串', () => {
    Object.keys(REGISTRY).forEach((id) => expect(getAssessment(id).ABBR, id).toBeTruthy());
  });
});

describe('列印工具列', () => {
  let portal;
  beforeEach(() => {
    portal = document.createElement('div'); portal.id = 'report-portal'; document.body.appendChild(portal);
    document.title = '原本的標題';
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
  });
  afterEach(() => { portal.remove(); vi.useRealTimers(); });

  it('報告開著時頁面標題＝檔名（另存 PDF 的預設檔名），列印時也設定，關閉後還原', () => {
    const config = getAssessment('leadership-9d');
    const result = buildResult(Object.fromEntries(config.ALL_QUESTIONS.map((q) => [q.id, 4])), config);
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { unmount } = render(<PrintableReport result={result} benchmark={null} user={{ name: '王小明', email: 'a@b.co' }} submittedAt="2026-11-01T00:00:00Z" groupName="測試班" onClose={() => {}} />);
    const expected = '測試班_L9D_個人報告_王小明_20261105';
    expect(document.title).toBe(expected);
    expect(screen.getByText(`存檔檔名：${expected}.pdf`)).toBeInTheDocument();
    document.title = '被別人改掉';
    fireEvent.click(screen.getByRole('button', { name: /列印/ }));
    expect(document.title).toBe(expected);
    expect(printSpy).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.title).toBe('原本的標題'); // 還原成報告開啟前的標題
  });
});

describe('iPhone 主畫面版的列印提示（手機 M3-3）', () => {
  it('standalone 的 iOS 不呼叫 window.print，改顯示說明；其他情況照常列印', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { useReportFilename, IOS_STANDALONE_PRINT_HINT } = await import('../survey/hooks/useReportFilename.js');
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    printSpy.mockClear(); // 前面的測試沒還原同一個 spy，先清掉累積的呼叫次數
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const uaSpy = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1');
    const mm = vi.fn().mockReturnValue({ matches: true });
    const original = window.matchMedia;
    window.matchMedia = mm;
    const { result } = renderHook(() => useReportFilename('x'));
    result.current();
    expect(alertSpy).toHaveBeenCalledWith(IOS_STANDALONE_PRINT_HINT);
    expect(printSpy).not.toHaveBeenCalled();
    // 不是 standalone：照常列印
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    result.current();
    expect(printSpy).toHaveBeenCalledTimes(1);
    window.matchMedia = original;
    uaSpy.mockRestore(); printSpy.mockRestore(); alertSpy.mockRestore();
  });
});

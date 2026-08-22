import { describe, it, expect } from 'vitest';
import { ASSESSMENT_SUMMARIES } from '../survey/marketing/assessmentSummary';
import { REGISTRY, getAssessment } from '../survey/data/assessments/index.js';

// 首頁的「評測工具庫」為了不把 35KB 的題庫拉進第一屏，是手抄一份摘要數字。
// 這支測試負責確保那份摘要不會跟真實題庫設定走鐘——首頁曾經寫死 L9D 的
// 「9 構面 / 20 子能力 / 90 題」，讓 AI 職能評測（6 構面 / 37 題）的訪客看到錯的規格。
describe('首頁評測工具庫摘要', () => {
  it('涵蓋所有已註冊的題庫，沒有遺漏也沒有多餘', () => {
    expect(ASSESSMENT_SUMMARIES.map((s) => s.id).sort()).toEqual(Object.keys(REGISTRY).sort());
  });

  it.each(ASSESSMENT_SUMMARIES)('$id 的構面數、題數、子能力數與實際設定一致', (summary) => {
    const config = getAssessment(summary.id);
    expect(config, `找不到題庫 ${summary.id}`).toBeTruthy();

    expect(summary.dimensions).toBe(config.DIMENSIONS.length);
    expect(summary.items).toBe(config.TOTAL_QUESTIONS);

    const actualSubs = config.DIMENSIONS.reduce((n, d) => n + (d.subDimensions?.length ?? 0), 0);
    expect(summary.subCompetencies).toBe(actualSubs);
  });

  it.each(ASSESSMENT_SUMMARIES)('$id 只有真的支援 360° 才在特色裡宣稱', (summary) => {
    const config = getAssessment(summary.id);
    const claims360 = summary.features.some((f) => f.includes('360'));
    expect(claims360).toBe(!!config.SUPPORTS_360);
  });
});

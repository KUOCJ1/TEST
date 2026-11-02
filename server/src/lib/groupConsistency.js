import { COURSE_SURVEY_ID } from './courseSurvey.js';

// 班級與資料的一致性檢查（Sprint 21-D）。起因：70 題 360 的資料被匯進 90 題的 L9D，班級開在 L9D，
// 沒有任何地方提醒「評量選錯了」，報告上才發現有構面是 0 分。這裡在班級總覽顯示警告，教練一眼就看得到。
//
// 只做「幾乎一定有問題」的提示，不阻擋任何操作：成員自己做過別份評量是正常的，所以
// 「別份評量」的警告只針對「批次匯入」的作答（source: imported）。

const nameOf = (data, id) => (data.assessments ?? []).find((a) => a.id === id)?.name ?? id;

/** @returns {Array<{code:string, level:'warn', message:string, count:number}>} */
export function groupWarnings(data, group) {
  const warnings = [];
  const memberIds = new Set(group.memberIds ?? []);
  const own = group.assessmentId ?? 'ai-competency';
  const allowed = new Set([own, ...(group.extraAssessmentIds ?? []), COURSE_SURVEY_ID]);
  const imported = (data.submissions ?? []).filter((s) => s.source === 'imported'
    && (memberIds.has(s.rateeId ?? s.userId) || memberIds.has(s.userId)));

  // 1. 成員有批次匯入的作答屬於別份評量。
  const other = imported.filter((s) => !allowed.has(s.assessmentId ?? 'ai-competency'));
  if (other.length > 0) {
    const ids = [...new Set(other.map((s) => s.assessmentId ?? 'ai-competency'))];
    warnings.push({
      code: 'imported-other-assessment',
      level: 'warn',
      count: other.length,
      message: `成員有 ${other.length} 筆批次匯入的作答屬於「${ids.map((id) => nameOf(data, id)).join('」「')}」，與這個班使用的評量「${nameOf(data, own)}」不同。如果這些是這個班要看的資料，可能是開班或匯入時選錯了評量。`,
    });
  }

  // 2. 這個班評量的匯入作答裡，有構面完全沒有作答（平均 0；量表是 1–5，不可能真的是 0）。
  const ownImported = imported.filter((s) => (s.assessmentId ?? 'ai-competency') === own);
  const blank = ownImported.filter((s) => (s.result?.dimensions ?? []).some((d) => typeof d.average === 'number' && d.average <= 0));
  if (blank.length > 0) {
    warnings.push({
      code: 'imported-blank-dimension',
      level: 'warn',
      count: blank.length,
      message: `有 ${blank.length} 筆匯入的作答，某些構面完全沒有作答（分數為 0）。可能是上傳時選錯評量、或檔案缺題。請確認後移除重匯。`,
    });
  }
  return warnings;
}

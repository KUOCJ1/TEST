// 課堂模式（Sprint 34）：教練在課堂上投影的班級畫面，資料全是彙總，沒有任何姓名或個人分數。
//
// 隱私規則：完成人數少於 MIN_CLASSROOM（3）時，整個畫面不給任何數字（分布與平均很容易被推回個人）。
// 之所以不是更高：班級常常只有 10 人上下，門檻高了教練根本用不到；3 與全站其他彙總（覆蓋率、目標概況）一致。
// 構面與落點分布都是「完成人數」的彙總，不含誰完成、誰沒完成。
import { startersFor } from '../data/goal-starters.js';
import { dimLabel } from './dimensionLabel.js';

export const MIN_CLASSROOM = 3;

/**
 * @param {{respondents:number, avgTotal:number, avgPercent:number, dimensionAverages:Array, levelDistribution:Array}} stats aggregateStats 的結果
 * @param {string} assessmentId
 * @param {{profileMode?:boolean}} [opts] 風格輪廓型題庫（DISC 等）沒有高低優劣：不排「強／弱」
 * @returns {{available:false, reason:string, respondents:number} | {available:true, ...}}
 */
export function buildClassroomSummary(stats, assessmentId, { profileMode = false } = {}) {
  const respondents = stats?.respondents ?? 0;
  if (respondents < MIN_CLASSROOM) {
    return { available: false, respondents, reason: `至少要有 ${MIN_CLASSROOM} 位同學完成，才會顯示班級畫面（人數太少時，平均容易被認出是誰）。` };
  }
  const dims = (stats.dimensionAverages ?? []).map((d) => ({ ...d, label: dimLabel(d) }));
  const sorted = [...dims].sort((a, b) => b.percent - a.percent);
  // 只有一兩個構面時，強弱會重疊；各取最多 3 個，且不重複。
  const n = Math.min(3, Math.floor(sorted.length / 2));
  const strongest = profileMode ? [] : sorted.slice(0, n);
  const weakest = profileMode ? [] : sorted.slice(-n).reverse();
  // 討論題：針對最弱的構面，從起手行動範例各取 1 條改寫成課堂活動（沒有範例就用通用的）。
  const prompts = weakest.slice(0, 2).map((d) => ({
    dimension: d.label,
    percent: d.percent,
    question: `在「${d.label}」上，我們這班目前最大的卡關是什麼？`,
    activity: (startersFor(assessmentId, d.id)[0] ?? '').replace(/[。.]$/, ''),
  }));
  const levelDistribution = (stats.levelDistribution ?? []).map((l) => ({ ...l, share: Math.round((l.count / respondents) * 100) }));
  return {
    available: true, respondents, profileMode,
    avgTotal: stats.avgTotal, avgPercent: stats.avgPercent,
    dimensions: dims, strongest, weakest, prompts, levelDistribution,
  };
}

/** 講義大綱（純文字，給教練複製到自己的備課文件）：只有彙總。 */
export function classroomOutline(groupName, summary) {
  if (!summary?.available) return '';
  const lines = [`【${groupName}】課堂討論大綱（${summary.respondents} 人完成）`, ''];
  if (!summary.profileMode) {
    lines.push('一、這班目前的優勢', ...summary.strongest.map((d) => `・${d.label}（${d.percent}%）`), '');
    lines.push('二、最值得一起練習的構面', ...summary.weakest.map((d) => `・${d.label}（${d.percent}%）`), '');
  }
  if (summary.prompts.length) {
    lines.push('三、討論題與活動');
    summary.prompts.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.question}`);
      if (p.activity) lines.push(`   活動建議：${p.activity}`);
    });
  }
  return lines.join('\n').trim();
}

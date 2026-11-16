import { getAssessment } from '../data/assessments/index.js';

/** 將 buildResult() 結果整理成可複製的純文字摘要。題庫可提供自己的 summaryText（沒有總分的評量）。 */
export function resultSummaryText(result) {
  const custom = getAssessment(result?.assessmentId)?.summaryText;
  if (typeof custom === 'function') return custom(result);
  return [
    `${result.assessmentName ?? '職能評測'} — 結果摘要`,
    `總得分：${result.total} / ${result.maxScore}（達成率 ${result.percent}%）`,
    `落點等級：${result.level.badge}（${result.level.badgeEn}）`,
    '',
    '各構面得分：',
    ...result.dimensions.map(
      (d) => `・${d.subtitle}（${d.name}）：${d.score}/${d.max}  ${d.percent}%  ${d.rating.label}`,
    ),
    '',
    `最強構面：${result.strongest.subtitle}  優先強化：${result.weakest.subtitle}`,
  ].join('\n');
}

export function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * <input type="date"> 要的 YYYY-MM-DD，用「當地」的年月日。
 * 不能用 toISOString().slice(0, 10)：那是 UTC 日期，台灣（UTC+8）當地 00:00 存下的時間會變成前一天，
 * 使用者打開「修改檢視日」看到的日期比自己選的早一天，按儲存還會再往前退一天。
 */
export function toDateInputValue(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 只有日期（YYYY/MM/DD），給開課日這類「時分沒有意義」的欄位用。 */
export function formatDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

export function formatDateShort(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** 將 buildResult() 結果整理成可複製的純文字摘要。 */
export function resultSummaryText(result) {
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

// 教練評語草稿（Sprint 28）：純函式、規則式、不呼叫外部 AI。
// 語氣：肯定導向——先說做得穩的地方，再說下一個值得投入的方向，最後給具體可做的行動。
// 草稿只是起點：開頭一定有 DRAFT_MARKER，教練改完刪掉才能存（避免不改就送出）。
import { dimLabel } from './dimensionLabel.js';
import { startersFor } from '../data/goal-starters.js';

export const DRAFT_MARKER = '【草稿，請依你對這位學員的觀察修改，並刪除這一行】';

const scored = (dims = []) => dims.filter((d) => typeof d.average === 'number' && d.average > 0);

/**
 * @param {object} result 學員的結果（dimensions 含 average）
 * @param {object} [opts]
 * @param {{blind?: object[], hidden?: object[]}} [opts.threeSixty] 360° 報告整理出的盲點與被低估的優勢
 * @returns {{text: string, tips: string[]}}
 */
export function buildCommentDraft(result, { threeSixty = null } = {}) {
  const dims = scored(result?.dimensions).sort((a, b) => b.average - a.average);
  if (dims.length === 0) return { text: DRAFT_MARKER, tips: [''] };
  const top = dims.slice(0, 2);
  const low = dims[dims.length - 1];
  const names = (list) => list.map((d) => `「${dimLabel(d)}」`).join('、');
  const parts = [DRAFT_MARKER, ''];
  parts.push(`這次的結果看得出你在${names(top)}上有穩定的基礎，這是你可以持續發揮、也能帶動身邊人的地方。`);
  if (dims.length > 2 && low.id !== top[0].id) {
    parts.push(`接下來最值得花力氣的是${names([low])}：不是因為做得差，而是這裡的進步空間最大，投入的回報也最明顯。`);
  }
  const hidden = threeSixty?.hidden?.[0];
  const blind = threeSixty?.blind?.[0];
  if (hidden) parts.push(`另外，他人在「${hidden.name}」看到的比你自己以為的更多，值得更有意識地運用。`);
  if (blind) parts.push(`在「${blind.name}」上，你的自我感覺與他人的感受有落差，可以找機會請他人具體說說看到的行為。`);
  parts.push('下面兩個小行動，建議兩週內挑一個先開始。');
  const starters = startersFor(result.assessmentId, low.id);
  const tips = [starters[0], starters[1] ?? starters[0]].filter(Boolean);
  return { text: parts.join('\n'), tips: tips.length ? tips : [''] };
}

/** 班級整體評語草稿：全班最強與最弱的構面（依平均百分比），語氣同上。 */
export function buildGroupCommentDraft(stats) {
  const dims = [...(stats?.dimensionAverages ?? [])].sort((a, b) => b.percent - a.percent);
  if (dims.length < 2 || !stats?.respondents) return { text: DRAFT_MARKER, tips: [''] };
  const top = dims.slice(0, 2);
  const low = dims[dims.length - 1];
  const names = (list) => list.map((d) => `「${dimLabel(d)}」`).join('、');
  const text = [
    DRAFT_MARKER, '',
    `這個班整體在${names(top)}上有不錯的共同基礎，是大家可以彼此分享做法的地方。`,
    `全班相對最需要一起加強的是${names([low])}，建議課程與課後行動都從這裡切入。`,
    '歡迎大家在下一次課前，各自挑一個行動試試看，我們再一起回顧。',
  ].join('\n');
  const starters = startersFor(stats.assessmentId ?? '', low.id);
  return { text, tips: starters.slice(0, 2).length ? starters.slice(0, 2) : [''] };
}

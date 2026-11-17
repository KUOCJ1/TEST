// 報告「一分鐘版」（Sprint 37）：結果頁最上面用三句白話說完——你在哪、你最穩的是什麼、最值得先練什麼。
// 只用作答結果與題庫設定（不另外計分），文字取自既有的構面說明與起手行動，不新寫評語。
import { dimensionText } from './narrative.js';
import { badgeText } from './levelBadge.js';
import { dimLabel } from './dimensionLabel.js';
import { startersFor } from '../data/goal-starters.js';

// 最高與最低構面差不到這麼多時，不硬挑「最該練」（反向題、四捨五入造成的小差異不算弱項）。
export const CLOSE_GAP = 0.3;

const firstSentence = (t) => {
  if (!t) return '';
  const m = String(t).match(/^[^。！？]*[。！？]/);
  return (m ? m[0] : String(t)).trim();
};

/**
 * @returns {null | {lines: Array<{label:string, text:string}>, focus: {id,label}|null}}
 */
export function buildOneMinute(result, config) {
  const dims = (result?.dimensions ?? []).filter((d) => typeof d.average === 'number' && d.average > 0);
  if (!dims.length) return null;
  const sorted = [...dims].sort((a, b) => b.average - a.average);
  const profileMode = Boolean(config?.PROFILE_MODE);

  if (profileMode) {
    // 風格輪廓型（DISC 等）：沒有高低優劣，不說「最該練」；改說主要風格與可以多留意的情境。
    const [p, s] = sorted;
    return {
      focus: null,
      lines: [
        { label: '你的風格', text: `你最明顯的風格是「${dimLabel(p)}」${s ? `，其次是「${dimLabel(s)}」` : ''}。` },
        { label: '怎麼看', text: '風格沒有好壞，只有適不適合當下的情境與對象。' },
        { label: '可以試試', text: '這週留意一次「我的習慣做法沒有效」的場合，想想另一種風格會怎麼做。' },
      ],
    };
  }

  const top = sorted[0];
  const low = sorted[sorted.length - 1];
  const level = result.level ?? {};
  // 上面的主視覺已經有落點名稱與分數：這裡不重複名稱，改用該落點說明的第一句講白話。
  const where = firstSentence(level.desc) || (level.badge ? `你目前在「${badgeText(level.badge)}」。` : '你已完成這份評量。');
  const lowText = firstSentence(dimensionText(low.id, low.average, config));
  const starter = startersFor(result.assessmentId, low.id)[0];
  return {
    focus: { id: low.id, label: dimLabel(low) },
    lines: [
      { label: '你在哪', text: where },
      { label: '你最穩的', text: `「${dimLabel(top)}」（平均 ${top.average.toFixed(1)}）是你目前最穩的地方，可以多拿來帶動其他面向。` },
      { label: '最值得先練', text: top.average - low.average < CLOSE_GAP
        ? '各構面的分數很接近，挑一個你最有感的開始就好。'
        : `「${dimLabel(low)}」（平均 ${low.average.toFixed(1)}）${lowText ? `：${lowText}` : '。'}${starter ? ` 可以從這件事開始：${starter.replace(/[。.]$/, '')}。` : ''}` },
    ],
  };
}

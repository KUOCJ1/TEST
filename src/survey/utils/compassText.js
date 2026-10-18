// 領導力羅盤報告的固定說明文字（與分數無關的模板）。
// 每個構面 × 等級的敘事評語是另一份獨立工作（S15b），不在這裡。
// 用語原則（規格 4.3）：不說「好／壞」，說「在什麼情境下這個取向會變成限制」。

/** 應變環與養成環的差距小於此值視為相當（⚠️ 暫定，待試測校準）。 */
export const LOOP_GAP = 0.3;

export function loopBalanceText(loops) {
  const fast = loops.find((l) => l.id === 'fast');
  const last = loops.find((l) => l.id === 'last');
  if (!fast || !last) return null;
  const d = fast.average - last.average;
  if (Math.abs(d) < LOOP_GAP) {
    return '應變環（反應與推進）與養成環（培育與傳承）的行為頻率相當，兩個環大致同步。';
  }
  if (d > 0) {
    return '應變環（反應與推進）的行為比養成環（培育與傳承）更常出現。短期成果與應變可能很有力；可留意的是，人才培養與經驗留存若長期排不上，之後會變成組織的限制。';
  }
  return '養成環（培育與傳承）的行為比應變環（反應與推進）更常出現。長期的基礎可能紮實；可留意的是，在需要快速判斷與推進的時刻，是否有足夠的節奏。';
}

export const TENSION_TYPE_LABEL = {
  both_high: '兩端兼顧',
  both_low: '兩端偏少',
  lean_a: '偏向前者',
  lean_b: '偏向後者',
  moderate: '大致均衡',
};

export function tensionLabel(t) {
  if (t.type === 'lean_a') return `偏向${t.nameA}`;
  if (t.type === 'lean_b') return `偏向${t.nameB}`;
  return TENSION_TYPE_LABEL[t.type] ?? '';
}

export function tensionText(t) {
  const A = `「${t.nameA}」`;
  const B = `「${t.nameB}」`;
  switch (t.type) {
    case 'both_high':
      return `${A}與${B}兩端都是您常用的行為，代表您能依情境來回切換。可留意的是：兩端都用得多時，團隊有時難以預期您此刻偏向哪一邊，把當下的取向說清楚會有幫助。`;
    case 'both_low':
      return `${A}與${B}兩端目前都較少出現。可以先挑一個具體情境，從其中一端開始練習，再逐步加入另一端。`;
    case 'lean_a':
      return `您的行為偏向${A}。在需要${A}的情境，這是您的優勢；當情境需要${B}時，這個偏重可能變成限制，值得留意有哪些場合需要刻意切換。`;
    case 'lean_b':
      return `您的行為偏向${B}。在需要${B}的情境，這是您的優勢；當情境需要${A}時，這個偏重可能變成限制，值得留意有哪些場合需要刻意切換。`;
    case 'moderate':
      return `${A}與${B}目前相對均衡，沒有明顯偏向哪一端。`;
    default:
      return '';
  }
}

export const READING_GUIDE = [
  '這份報告描述的是行為出現的「頻率」，不是能力高低，也沒有標準答案。',
  '應變環與養成環沒有誰比較重要；重點是兩個環能否互相支撐。',
  '「張力」指的是兩種都有價值、卻常需要取捨的行為。偏向某一端不是缺點，而是提醒您在哪些情境需要切換。',
];

export const GAP_TEXT = {
  blind_spot: '自評高於他評',
  hidden_strength: '他評高於自評',
  aligned: '大致一致',
};

/** 兩個環的白話說明（報告畫面與列印版共用）。 */
export const LOOP_EXPLAIN = '應變環看的是面對眼前的事，你多快看清情勢、定下方向、把事情交給對的人、把大家帶動起來；養成環看的是你不在的時候能力還在不在：怎麼學、怎麼穩住、怎麼培養人、怎麼把經驗留下來。';

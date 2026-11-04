// 經贏® 領導力八大構面行為評量（70 題）：適用一般管理主管。最初為客戶專案（森永高階教練 360 評鑑）的題庫，題目歸顧問團隊所有，已公開。
//
// 框架直接沿用 L9D（經贏® 領導力九大構面行為評量，見 leadership-9d.js）：構面、子能力、顏色、圈層、
// 等級名稱、構面評級與子能力敘事評語都取自 L9D，所以報告、雷達圖、敘事報告與 L9D 班級是同一套；
// 題目則保留客戶的 70 題（取自客戶的 Google 表單，1–5 分、全部正向敘述）。題號 l1–l70 與表單的
// 「1.」到「70.」一一對應，表單匯出的欄位可以直接批次上傳。
//
// 題目與 L9D 子能力的對照（依表單題號的區塊順序與內容整理，見 docs/leadership-360-70-mapping.md）：
//   1–12 溝通力（聆聽 1–4／處理訊息 5–8／有效溝通 9–12）、13–26 領導影響力（信任 13–17／方向 18–21／授權 22–26）、
//   34–43 協作關係、44–50 任務管理、51–57 執行力、58–64 人才發展、65–70 自我成長；
//   27–33（應變與創新）在 L9D 沒有對應的構面，另列為第 8 個構面。
//   L9D 的「思辨與決策」「接班成熟度」在這 70 題裡沒有題目，所以不列入。
// 對照是暫定版，客戶有正式分組時只要改 BLOCKS，不影響已匯入的作答（答案以題號保存，但已匯入的結果是
// 匯入當下算好的快照，改分組後要重新匯入才會反映）。
//
// 與 L9D 的關係：兩套共用「核心 7 構面」（溝通力、協作關係、任務管理、執行力、領導影響力、人才發展、自我成長，
// 見 utils/coreDimensions.js），可用核心構面平均跨題庫比較；本題庫另有「應變與創新」，L9D 另有「思辨與決策」「接班成熟度」。
import * as L9D from './leadership-9d.js';

export const ID = 'leadership-360-70';
// 題庫結構版本（結構一變就要升版，見 utils/assessmentFingerprint.js）。分組變動後已匯入的結果要移除重匯。
export const ITEM_VERSION = '2026-11';
export const SUPPORTS_360 = true;
export const NAME = '經贏® 領導力八大構面行為評量（70 題）';
export const NAME_EN = 'Leadership Eight-Dimension Behavioral Assessment (70 items)';
export const ABBR = 'L8D';
export const DESCRIPTION = '8 大構面、70 題行為評量，沿用經贏® 領導力構面框架，適用一般管理主管；可整合自評與主管、同儕、部屬的他評，作為發展回饋。';
export const RATER_PROMPT = L9D.RATER_PROMPT;

export const SCALE_MIN = L9D.SCALE_MIN;
export const SCALE_MAX = L9D.SCALE_MAX;
export const SCALE_LABELS = L9D.SCALE_LABELS;

// 客戶表單的題目文字（題號 → 原文）。
const ITEM_TEXT = {
  1: '向他人徵求想法、意見與建議',
  2: '創造一個可以公開討論議題的環境',
  3: '願意開放心胸的聆聽更多意見',
  4: '總是仔細地聆聽不會打斷他人',
  5: '能總結他人意見，並確認理解是否正確',
  6: '能夠辨識議題的核心要素有哪些',
  7: '作決定能考慮優缺點、短中長期的結果',
  8: '能依邏輯處理訊息，並得出清楚的結論',
  9: '能將想法清楚地寫出來',
  10: '是一個有說話有架構及令人印象深刻的演說者',
  11: '認真仔細地描述一件事不誇飾',
  12: '有話直說的溝通方式，即使在處理敏感的議題上',
  13: '能夠準備好目前工作相關資訊，讓相關人員可以使用',
  14: '總是信守承諾',
  15: '是可以被託付機密資訊的人',
  16: '與他人互動是坦誠的',
  17: '展現高道德標準',
  18: '說清楚自己期待',
  19: '建立可管理的工作量',
  20: '透過規劃循序漸進的步驟完成長期的目標',
  21: '在執行細節工作時依然可聚焦在大方向上',
  22: '知道何時交辦他人何時自我負責',
  23: '能適才適所的分配工作',
  24: '給予他人權限去獨完成工作，且能有效協助並管理目標/成果',
  25: '授權他人以發現具創意的問題解決方案',
  26: '因著不同的工作型態彈性調整人員管理',
  27: '在多變的環境下，仍能遊刃有餘且自在地工作',
  28: '面對挫折，能有建設性的回應',
  29: '參與變革及為變化做好計畫',
  30: '以想像力和原創性來處理工作',
  31: '在組織中鼓勵創新',
  32: '願採取大膽且可控制的方案',
  33: '視阻礙為創新改變的契機',
  34: '關懷他人的感受',
  35: '對人員的用字與行為舉止上，不會存有偏見與刻板印象',
  36: '會給予婉轉與建設性的回饋 (criticism)',
  37: '在高工作壓力下仍然怡然自若',
  38: '公平地解決衝突',
  39: '創造團隊合作的氛圍以面對競爭',
  40: '在團隊中建立一致性的決策',
  41: '領導團隊建立達成組織願景的目標',
  42: '將有才能的人引進團隊中',
  43: '在團隊中運用多樣才能及經驗的人，追求團隊最大利益',
  44: '將現代科技運用在實際工作中，以尋求效率最大化',
  45: '有效率地使用外部資源',
  46: '避免工作拖延',
  47: '將工作設立先後順序，並依循執行',
  48: '掌握執行工作所需的基本知識、技能',
  49: '能夠快速學習新知並運用在工作中',
  50: '適當將新理論、方法融入企業運作',
  51: '知道何時該停止規劃並開始執行',
  52: '能率先帶領讓事情發生',
  53: '能果決處理問題',
  54: '下決策可以精準即時',
  55: '克服障礙以成功完成專案任務',
  56: '能設定高標準給團隊並促使達到結果',
  57: '一般來說，可達到結果並對組織有正向影響',
  58: '是一位有耐心、能有效幫助或回饋他人(部屬)的教練',
  59: '提供他人訓練發展以強化技能發展及專業成長',
  60: '能針對他人的優勢及需求提供客觀的評價',
  61: '能提供即時的目標或工作進度管理時程，以供審視及追蹤',
  62: '對於高品質工作的產出給予認可',
  63: '當他人付出額外努力，願意發自內心感激',
  64: '能將熱情感染他人，以鼓勵及促進正向態度',
  65: '能一直維持在高活力的狀態',
  66: '對任務目標堅持不懈',
  67: '對未來展望保持正向的態度',
  68: '願意承認錯誤並從中學習到',
  69: '願意接受建設性的批評',
  70: '能找出並追蹤改善績效的資源',
};

// L9D 構面 id → 子能力 id → 題號。順序即報告上的構面順序。
const BLOCKS = [
  ['communication', { listening: [1, 2, 3, 4], processing: [5, 6, 7, 8], expressing: [9, 10, 11, 12] }],
  ['collaboration', { 'build-relations': [34, 35, 36, 37, 38], 'lead-team': [39, 40, 41, 42, 43] }],
  ['task-management', { efficiency: [44, 45, 46, 47], competence: [48, 49, 50] }],
  ['execution', { 'take-action': [51, 52, 53, 54], 'create-results': [55, 56, 57] }],
  ['leadership-impact', { trust: [13, 14, 15, 16, 17], direction: [18, 19, 20, 21], delegation: [22, 23, 24, 25, 26] }],
  ['developing-others', { cultivate: [58, 59, 60, 61], motivate: [62, 63, 64] }],
  ['self-development', { commitment: [65, 66, 67], improvement: [68, 69, 70] }],
];

// L9D 沒有對應的區塊：27–33（應變與創新）。
const EXTRA_DIMENSION = {
  id: 'adaptive-innovation', name: '應變與創新', subtitle: 'Adaptability & Innovation', color: '#d53f8c', layer: 'organizational',
  subDimensions: [
    { id: 'adapting', name: '因應環境變化' },
    { id: 'innovating', name: '創新思考' },
  ],
  blocks: { adapting: [27, 28, 29], innovating: [30, 31, 32, 33] },
};

const clone = (x) => JSON.parse(JSON.stringify(x));
const questionsOf = (blocks) => Object.entries(blocks).flatMap(([subId, nums]) => nums.map((n) => ({ id: `l${n}`, text: ITEM_TEXT[n], reversed: false, subId })));

const l9dDims = BLOCKS.map(([dimId, blocks]) => {
  const base = L9D.DIMENSIONS.find((d) => d.id === dimId);
  const { questions: _q, ...meta } = clone(base);
  // 只保留實際有題目的子能力（與 L9D 相同的名稱與 id）。
  meta.subDimensions = meta.subDimensions.filter((s) => blocks[s.id]);
  return { ...meta, questions: questionsOf(blocks) };
});
const { blocks: extraBlocks, ...extraMeta } = EXTRA_DIMENSION;

export const DIMENSIONS = [
  ...l9dDims,
  { ...clone(extraMeta), questions: questionsOf(extraBlocks) },
].map((d, i) => ({ ...d, index: i + 1 }));

// 圈層：沿用 L9D，拿掉沒有題目的構面，並把額外構面放在「組織領導」。
export const LAYERS = clone(L9D.LAYERS).map((layer) => ({
  ...layer,
  dimensions: [...layer.dimensions, ...(layer.id === 'organizational' ? ['adaptive-innovation'] : [])]
    .filter((id) => DIMENSIONS.some((d) => d.id === id)),
}));

export const ALL_QUESTIONS = DIMENSIONS.flatMap((d) => d.questions);
export const TOTAL_QUESTIONS = ALL_QUESTIONS.length;
export const MIN_SCORE = TOTAL_QUESTIONS * SCALE_MIN;
export const MAX_SCORE = TOTAL_QUESTIONS * SCALE_MAX;

// 等級：沿用 L9D 的四個等級（id、名稱、顏色、說明），門檻改成本題庫總分（70–350）的同比例（50%／70%／90%）。
// 說明文字裡提到「九大構面」「接班成熟度」的地方改成本題庫的說法。暫定，累積資料後再校準。
const cut = (pct) => Math.round(MAX_SCORE * pct);
const LEVEL_RANGES = { explorer: [MIN_SCORE, cut(0.5)], developer: [cut(0.5) + 1, cut(0.7)], proficient: [cut(0.7) + 1, cut(0.9)], leader: [cut(0.9) + 1, MAX_SCORE] };
export const LEVELS = clone(L9D.LEVELS).map((l) => {
  const [min, max] = LEVEL_RANGES[l.id];
  return {
    ...l,
    min,
    max,
    desc: l.desc.replace('九大構面均有', '各構面均有'),
    advice: l.advice.replace('「接班成熟度」與「思辨決策」能力', '「應變與創新」與「領導影響力」能力'),
  };
});

export const dimensionRating = L9D.dimensionRating;

// 敘事評語：沿用 L9D 的子能力評語；L9D 沒有的兩個子能力（因應環境變化、創新思考）採用
// 「領導力八大構面回饋語句 V5.0」的正式語句（取代先前暫定版）。
export const COMMENTARY = {
  ...clone(L9D.COMMENTARY),
  adapting: {
    high: '能靈活調整作法應對變化，並在壓力中保持穩定的工作狀態',
    mid: '面對變化能進行基本調整，在高壓或突發狀況中仍有穩定反應',
    low: '在面對變動或壓力時若僵化反應，可能影響調整速度與團隊士氣',
  },
  innovating: {
    high: '鼓勵新想法並以開放態度接納創新，是促進組織進步的推手',
    mid: '具開放態度與嘗試精神，在既有流程中能適度提出創新作法',
    low: '偏好既定方式、對於新的嘗試容易猶豫而不採取行動，可能錯失提升效率或突破現狀的機會',
  },
};

// 構面層說明：沿用 L9D（含「應變與創新」）。
export const DIMENSION_COMMENTARY = clone(L9D.DIMENSION_COMMENTARY);

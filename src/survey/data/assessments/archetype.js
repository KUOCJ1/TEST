export const ID = 'archetype';
export const NAME = '識己®性格原型評測';
export const NAME_EN = 'Self-Insight Archetype Assessment';
export const ABBR = '識己';
export const DESCRIPTION = '4 組性格光譜、40 題李克特量表（含反向題），呈現原創的 16 種性格原型組合——沒有哪一型比較好，只有比較像你。';

// 這是一份「自陳偏好」量表：測的是你天生比較自在的內在傾向（怎麼充電、怎麼
// 吸收資訊、怎麼做決定、怎麼安排生活），不是外顯行為表現。這跟 DISC 那種
// 「觀察得到的行為風格」不一樣——請別人猜測「這個人天生比較偏內向還外向」
// 的效度遠不如本人自陳，因此不開放 360° 多元評測。
export const SUPPORTS_360 = false;

// 跟 DISC 一樣不用「總分→成熟度」模型，但推導方式不同：DISC 是四個彼此獨立
// 的構面比大小，這裡則是四組「二元對立」的光譜（如外向 vs 內向），每一軸各自
// 判斷落在哪一端，四軸的端點組合成一個原創代碼，對照 16 種原型。見下方
// getProfileKey()。
export const PROFILE_MODE = true;

export const SCALE_MIN = 1;
export const SCALE_MAX = 5;

export const SCALE_LABELS = [
  { value: 1, label: '非常不同意' },
  { value: 2, label: '不太同意' },
  { value: 3, label: '普通' },
  { value: 4, label: '大致同意' },
  { value: 5, label: '非常同意' },
];

// 四軸的「兩端」定義：code 用來組成 16 型代碼（原創的單一中文字，刻意不用
// E/I、S/N、T/F、J/P 這組官方縮寫，避免與特定商用測驗的呈現方式混淆）。
// low = 平均分數 < 3（量表中點）時判定的一端；high = >= 3 時的一端。
// trait 是給敘事段落組合用的句子片段；tip（僅能量軸／決策軸提供）是跟另一端
// 的人合作時的提醒，供風格原型的 advice 組合用。
const AXES = [
  {
    id: 'energy', index: 1, name: '能量來源', subtitle: '外向充電 ↔ 內向充電', color: '#dd6b20',
    low: {
      code: '內', label: '內向充電型',
      trait: '您透過獨處與內在思考恢復精力，習慣先想清楚再開口',
      tip: '跟外向的夥伴合作時，別急著在會議上立刻回應——可以請對方給你一點時間消化，你的深度思考通常能補上團隊沒想到的細節。',
    },
    high: {
      code: '外', label: '外向充電型',
      trait: '您透過與人互動恢復精力，習慣邊討論邊把想法整理清楚',
      tip: '跟內向的夥伴合作時，記得給對方一些安靜思考的空間，不用急著要他們當下給答案，事後追蹤反而能得到更完整的想法。',
    },
    questions: [
      { id: 'a1', text: '參加完一整天的聚會後，我通常覺得更有活力，而不是需要獨處恢復。', reversed: false },
      { id: 'a2', text: '我喜歡一邊跟人討論，一邊把想法整理清楚。', reversed: false },
      { id: 'a3', text: '面對新環境，我傾向主動認識新朋友，而不是先在旁邊觀察。', reversed: false },
      { id: 'a4', text: '我常常話說出口後，才發現自己原來是這麼想的。', reversed: false },
      { id: 'a5', text: '團體活動比一個人做事更能激發我的動力。', reversed: false },
      { id: 'a6', text: '我很容易在聊天中就分享自己正在想的事。', reversed: false },
      { id: 'a7', text: '比起先想清楚再開口，我更習慣邊講邊想。', reversed: false },
      { id: 'a8', text: '長時間獨處會讓我覺得有點悶、缺乏活力。', reversed: false },
      { id: 'a9', text: '我需要獨處的時間來充電，社交場合久了會讓我感到疲憊。', reversed: true },
      { id: 'a10', text: '開口之前，我習慣先在腦中把話想清楚。', reversed: true },
    ],
  },
  {
    id: 'information', index: 2, name: '資訊接收', subtitle: '具體實證 ↔ 概念聯想', color: '#3182ce',
    low: {
      code: '實', label: '具體實證型',
      trait: '您重視實際經驗與具體細節，習慣依循過去驗證有效的方法',
      tip: null,
    },
    high: {
      code: '念', label: '概念聯想型',
      trait: '您重視可能性與抽象關聯，習慣從趨勢和模式思考',
      tip: null,
    },
    questions: [
      { id: 'a11', text: '我常常在討論中聯想到看似不相關、但其實有關聯的想法。', reversed: false },
      { id: 'a12', text: '比起眼前的細節，我更容易被「這件事未來可能發展成什麼」吸引。', reversed: false },
      { id: 'a13', text: '我喜歡討論抽象的概念與可能性，勝過討論具體的操作細節。', reversed: false },
      { id: 'a14', text: '我常常憑直覺就能感覺到事情的走向，即使還沒有明確證據。', reversed: false },
      { id: 'a15', text: '我對「還沒發生但可能發生的事」比對「已經確定的事實」更感興趣。', reversed: false },
      { id: 'a16', text: '我習慣用比喻或模式來理解新的概念。', reversed: false },
      { id: 'a17', text: '我喜歡探索新方法，即使還沒有前例可循。', reversed: false },
      { id: 'a18', text: '面對一堆資訊時，我會先抓整體的脈絡與意義，而非逐條細節。', reversed: false },
      { id: 'a19', text: '我重視實際做過、驗證有效的方法，勝過還沒被驗證的新點子。', reversed: true },
      { id: 'a20', text: '我做事習慣先確認清楚具體細節，再往下進行。', reversed: true },
    ],
  },
  {
    id: 'decision', index: 3, name: '決策依據', subtitle: '人本考量 ↔ 邏輯分析', color: '#805ad5',
    low: {
      code: '情', label: '人本考量型',
      trait: '決策時您優先考慮對人的影響，以及是否符合大家的價值觀',
      tip: '面對重邏輯的夥伴時，試著先理解對方是以客觀標準而非針對你在做判斷——你的同理心是團隊裡很珍貴的潤滑劑。',
    },
    high: {
      code: '理', label: '邏輯分析型',
      trait: '決策時您優先依據邏輯是否站得住腳，以及客觀分析的結果',
      tip: '面對重人本考量的夥伴時，記得先確認對方的感受有被聽見，再切入邏輯討論——你的清晰分析會更容易被團隊接受。',
    },
    questions: [
      { id: 'a21', text: '做決定時，我優先考慮邏輯是否站得住腳，而不是誰會因此不開心。', reversed: false },
      { id: 'a22', text: '我認為對事不對人，即使結果可能讓某些人不舒服。', reversed: false },
      { id: 'a23', text: '我習慣用客觀標準來評估一件事的對錯，而非當下的人情。', reversed: false },
      { id: 'a24', text: '給別人回饋時，我會直接指出問題，即使語氣可能顯得直接。', reversed: false },
      { id: 'a25', text: '面對衝突，我傾向先釐清事實與邏輯，而非先安撫情緒。', reversed: false },
      { id: 'a26', text: '我認為公平一致的規則比彈性通融更重要。', reversed: false },
      { id: 'a27', text: '分析問題時，我習慣先拆解因果關係，再考慮人的感受。', reversed: false },
      { id: 'a28', text: '我不容易因為同情某個人，而改變自己原本的判斷。', reversed: false },
      { id: 'a29', text: '做決定時，我會優先考慮這個決定對相關的人有什麼影響。', reversed: true },
      { id: 'a30', text: '比起邏輯對錯，我更在意這麼做是否符合大家的感受與價值觀。', reversed: true },
    ],
  },
  {
    id: 'lifestyle', index: 4, name: '生活型態', subtitle: '彈性隨行 ↔ 計畫掌控', color: '#d53f8c',
    low: {
      code: '隨', label: '彈性隨行型',
      trait: '生活步調上您喜歡保持選項開放，隨情況調整計畫',
      tip: null,
    },
    high: {
      code: '序', label: '計畫掌控型',
      trait: '生活步調上您喜歡提前規劃並依計畫執行，重視確定性',
      tip: null,
    },
    questions: [
      { id: 'a31', text: '我喜歡提前把計畫訂好，照表操課讓我覺得安心。', reversed: false },
      { id: 'a32', text: '待辦事項沒有完成，會讓我感到不安，直到處理掉為止。', reversed: false },
      { id: 'a33', text: '出門前我習慣先確認好行程與時間安排。', reversed: false },
      { id: 'a34', text: '我偏好在期限之前就把事情做完，不喜歡卡在最後一刻。', reversed: false },
      { id: 'a35', text: '面對還沒決定的事情，我會想盡快拍板定案。', reversed: false },
      { id: 'a36', text: '我喜歡工作空間跟時間安排都井然有序。', reversed: false },
      { id: 'a37', text: '計畫被臨時打亂，會讓我感到明顯的壓力。', reversed: false },
      { id: 'a38', text: '我習慣把目標拆解成清楚的步驟，一步步照著做。', reversed: false },
      { id: 'a39', text: '我喜歡保留彈性，很少把行程排得太死。', reversed: true },
      { id: 'a40', text: '面對突發狀況，我反而覺得興奮，喜歡見招拆招。', reversed: true },
    ],
  },
];

export const DIMENSIONS = AXES.map(({ id, index, name, subtitle, color, questions }) => ({
  id, index, name, subtitle, color, questions,
}));

export const ALL_QUESTIONS = DIMENSIONS.flatMap((d) => d.questions);
export const TOTAL_QUESTIONS = ALL_QUESTIONS.length;
export const MIN_SCORE = TOTAL_QUESTIONS * SCALE_MIN;
export const MAX_SCORE = TOTAL_QUESTIONS * SCALE_MAX;

// 16 型代碼（依 AXES 順序：能量＋資訊＋決策＋生活型態）各自的原創命名——
// 不沿用任何既有人格測驗的型態名稱／代碼字母。
const TYPE_NAMES = {
  內實情隨: { badge: '🌱 守心園丁', badgeEn: 'Quiet Gardener', color: '#38a169' },
  內實情序: { badge: '🏡 溫暖管家', badgeEn: 'Steady Caretaker', color: '#2f855a' },
  內實理隨: { badge: '🔧 獨立工匠', badgeEn: 'Independent Craftsman', color: '#4a5568' },
  內實理序: { badge: '📋 精算監督', badgeEn: 'Precision Overseer', color: '#2c5282' },
  內念情隨: { badge: '🖋️ 靜謐詩人', badgeEn: 'Quiet Idealist', color: '#6b46c1' },
  內念情序: { badge: '🧭 理想舵手', badgeEn: 'Purposeful Navigator', color: '#553c9a' },
  內念理隨: { badge: '🏛️ 思維建築師', badgeEn: 'Conceptual Architect', color: '#2b6cb0' },
  內念理序: { badge: '♟️ 戰略規劃者', badgeEn: 'Strategic Planner', color: '#1a365d' },
  外實情隨: { badge: '🤗 熱情夥伴', badgeEn: 'Warm Companion', color: '#dd6b20' },
  外實情序: { badge: '📣 團隊召集人', badgeEn: 'Team Convener', color: '#c05621' },
  外實理隨: { badge: '⚡ 行動先鋒', badgeEn: 'Action Pioneer', color: '#c53030' },
  外實理序: { badge: '🎯 執行指揮官', badgeEn: 'Execution Commander', color: '#9b2c2c' },
  外念情隨: { badge: '✨ 靈感催化者', badgeEn: 'Inspiring Catalyst', color: '#d53f8c' },
  外念情序: { badge: '📢 願景倡議者', badgeEn: 'Vision Advocate', color: '#b83280' },
  外念理隨: { badge: '🧪 創新實驗家', badgeEn: 'Bold Experimenter', color: '#3182ce' },
  外念理序: { badge: '🚀 系統開創者', badgeEn: 'Systems Pioneer', color: '#2a4365' },
};

function composeDesc(poles) {
  const [energy, information, decision, lifestyle] = poles;
  return `${energy.trait}；${information.trait}。${decision.trait}；${lifestyle.trait}。`;
}

function composeAdvice(poles) {
  const [energy, , decision] = poles;
  return `${energy.tip} ${decision.tip}`;
}

// 依 AXES 的 low/high 兩端做笛卡兒積，程式化產生全部 16 種組合——不用手動
// 把 16 個物件文字都寫一遍，四軸的措辭改動也只需要改一處。
function buildProfiles() {
  const profiles = {};
  const combos = AXES.reduce(
    (acc, axis) => acc.flatMap((prefix) => [
      [...prefix, axis.low],
      [...prefix, axis.high],
    ]),
    [[]],
  );
  for (const poles of combos) {
    const key = poles.map((p) => p.code).join('');
    const named = TYPE_NAMES[key];
    profiles[key] = {
      id: key,
      badge: named?.badge ?? `🔹 ${key}型`,
      badgeEn: named?.badgeEn,
      color: named?.color ?? '#718096',
      desc: composeDesc(poles),
      advice: composeAdvice(poles),
    };
  }
  return profiles;
}

export const PROFILES = {
  ...buildProfiles(),
  default: {
    id: 'balanced', badge: '⚖️ 均衡探索者', badgeEn: 'Balanced Explorer', color: '#718096',
    desc: '您在四組性格光譜上的表現相當均衡，沒有特別靠向單一端點——這代表您能視情境彈性展現不同的一面。',
    advice: '善用您的彈性，觀察不同情境下哪一種傾向最合適，並留意在團隊中主動說明自己當下採取的是哪種節奏，讓其他人更容易理解你。',
  },
};

// PrintableReport／aggregateStats 等既有元件用陣列形式列出全部原型（不含
// default 防呆項），跟 DISC 的做法一致。
export const LEVELS = Object.entries(PROFILES)
  .filter(([key]) => key !== 'default')
  .map(([, level]) => level);

/**
 * 四軸各自判斷落在哪一端，組成一個 4 碼原創代碼（如「外念理序」）。跟 DISC
 * 「比大小」的 getProfileKey 不同，這裡的兩端是互斥的光譜，因此看 average
 * 是否 >= 量表中點（3）決定屬於哪一端；再依 AXES 的固定順序組成代碼。
 */
export function getProfileKey(dimensions) {
  return AXES
    .map((axis) => {
      const dim = dimensions.find((d) => d.id === axis.id);
      const pole = (dim?.average ?? 0) >= 3 ? axis.high : axis.low;
      return pole.code;
    })
    .join('');
}

/**
 * 這是二元對立的光譜，不是「越高越好」的能力量表——量表中點（3分／50%）
 * 代表真正的均衡，不是「表現不佳」。因此不能沿用 DISC／L9D 那種「分數越高
 * 標籤越正向」的寫法，改用「離中點的距離」判斷傾向有多明確。
 */
export function dimensionRating(average) {
  const distance = Math.abs(average - 3);
  if (distance >= 1.4) return { label: '傾向非常明確', tone: 'strong' };
  if (distance >= 0.8) return { label: '傾向明確', tone: 'good' };
  if (distance >= 0.4) return { label: '略有傾向', tone: 'mid' };
  return { label: '均衡', tone: 'low' };
}

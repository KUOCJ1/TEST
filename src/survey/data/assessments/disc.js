export const ID = 'disc';
export const NAME = 'DISC 行為風格評測';
export const NAME_EN = 'DISC Behavioral Style Assessment';
export const ABBR = 'DISC';
export const DESCRIPTION = '4 大構面、32 題李克特量表（含反向題），呈現行為風格輪廓而非能力高低——沒有哪一型比較好，只有比較像你。';
export const SUPPORTS_360 = true;

// 跟 ai-competency／leadership-9d 的「總分→成熟度」模型不同：DISC 四個構面是
// 平行的行為風格，不是可以加總、排優劣的能力項目。開啟這個旗標後 buildResult()
// 會改用 getProfileLevel()（依最高兩個構面的組合查 PROFILES），不會產生一個
// 「總分」意義的成熟度徽章，見 utils/scoring.js 的說明。
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

export const DIMENSIONS = [
  {
    id: 'dominance', index: 1, name: '支配型', subtitle: 'D 支配型', color: '#e53e3e',
    questions: [
      { id: 'ds1', text: '面對問題時，我傾向直接做出決定，而不是等待更多資訊才行動。', reversed: false },
      { id: 'ds2', text: '我喜歡設定具挑戰性的目標，並全力衝刺達成。', reversed: false },
      { id: 'ds3', text: '在團隊討論陷入僵局時，我會主動提出明確方向，推動事情前進。', reversed: false },
      { id: 'ds4', text: '我不害怕表達與他人不同的意見，即使可能引發爭論。', reversed: false },
      { id: 'ds5', text: '比起按部就班，我更傾向用最快的方式達成結果。', reversed: false },
      { id: 'ds6', text: '遇到阻礙時，我會想辦法排除障礙，而不是繞路而行。', reversed: false },
      { id: 'ds7', text: '我習慣主導對話的節奏，掌握討論的方向。', reversed: false },
      { id: 'ds8', text: '我通常傾向讓別人先做決定，自己再配合。', reversed: true },
    ],
  },
  {
    id: 'influence', index: 2, name: '影響型', subtitle: 'I 影響型', color: '#d69e2e',
    questions: [
      { id: 'ds9', text: '我很容易跟陌生人打開話匣子，建立初步的熟悉感。', reversed: false },
      { id: 'ds10', text: '我喜歡在團隊中營造熱絡、正向的氣氛。', reversed: false },
      { id: 'ds11', text: '分享想法時，我習慣用生動、有畫面感的方式表達。', reversed: false },
      { id: 'ds12', text: '我常常能感染身邊的人一起投入某件事。', reversed: false },
      { id: 'ds13', text: '我喜歡透過口頭討論來激盪想法，勝過安靜地寫下來。', reversed: false },
      { id: 'ds14', text: '面對新認識的人，我會主動找話題拉近距離。', reversed: false },
      { id: 'ds15', text: '我樂於在眾人面前分享自己的想法或經驗。', reversed: false },
      { id: 'ds16', text: '在人多的場合，我通常比較安靜，不會主動找人聊天。', reversed: true },
    ],
  },
  {
    id: 'steadiness', index: 3, name: '穩健型', subtitle: 'S 穩健型', color: '#38a169',
    questions: [
      { id: 'ds17', text: '我重視工作與生活中的穩定節奏，不喜歡頻繁的變動。', reversed: false },
      { id: 'ds18', text: '面對衝突時，我傾向先安撫情緒，再處理問題本身。', reversed: false },
      { id: 'ds19', text: '一旦承諾了某件事，我會盡力維持到底，不輕易改變。', reversed: false },
      { id: 'ds20', text: '我習慣耐心聽完別人把話說完，再給出回應。', reversed: false },
      { id: 'ds21', text: '在團隊中，我常扮演協調、緩和氣氛的角色。', reversed: false },
      { id: 'ds22', text: '我做事偏好按照熟悉的流程，而不是每次都嘗試新的方法。', reversed: false },
      { id: 'ds23', text: '我重視與同事之間長期、穩定的信任關係。', reversed: false },
      { id: 'ds24', text: '我對變動的接受度很高，經常主動求新求變。', reversed: true },
    ],
  },
  {
    id: 'conscientiousness', index: 4, name: '謹慎型', subtitle: 'C 謹慎型', color: '#3182ce',
    questions: [
      { id: 'ds25', text: '做決定前，我習慣先蒐集足夠的資料再下判斷。', reversed: false },
      { id: 'ds26', text: '我會仔細檢查工作細節，確保沒有疏漏或錯誤。', reversed: false },
      { id: 'ds27', text: '我重視邏輯與數據，勝過憑直覺行事。', reversed: false },
      { id: 'ds28', text: '面對規則與流程，我傾向確實遵守，而不是便宜行事。', reversed: false },
      { id: 'ds29', text: '我習慣把想法整理成清楚的架構，再跟別人溝通。', reversed: false },
      { id: 'ds30', text: '在下結論之前，我會反覆確認各種可能性與風險。', reversed: false },
      { id: 'ds31', text: '我對品質要求較高，寧可多花時間也要把事情做到位。', reversed: false },
      { id: 'ds32', text: '我做事比較憑感覺，較少花時間反覆確認細節。', reversed: true },
    ],
  },
];

export const ALL_QUESTIONS = DIMENSIONS.flatMap((d) => d.questions);
export const TOTAL_QUESTIONS = ALL_QUESTIONS.length;
export const MIN_SCORE = TOTAL_QUESTIONS * SCALE_MIN;
export const MAX_SCORE = TOTAL_QUESTIONS * SCALE_MAX;

/**
 * 風格組合對照表：key 為兩個構面 id 依字母序排序後用 '+' 相接（見
 * utils/scoring.js 的 getProfileLevel()）。四個構面兩兩組合共 6 種，涵蓋所有
 * 可能結果；default 僅在極端平手情境（理論上不會發生，保留作為防呆）使用。
 *
 * 每則內容刻意不寫「你哪裡不夠好、要加強」，而是寫「這個組合的行為特徵」＋
 * 「跟其他風格合作時的提醒」——風格沒有優劣，只有怎麼互補。
 */
export const PROFILES = {
  'dominance+influence': {
    id: 'di', badge: '🔥 魅力領導者', badgeEn: 'Driving Influencer', color: '#e53e3e',
    desc: '您同時展現果斷行動與感染他人的特質——敢於做決定，也擅長帶動團隊士氣。遇到挑戰時，您傾向直接出擊並用熱情說服身邊的人一起投入，是天生的破局者與帶頭衝的角色。',
    advice: '與您合作的人通常會被您的行動力和熱情帶動；面對重視細節與流程的 C 型夥伴時，記得放慢步調、多留一些討論空間，避免對方覺得被推著走。',
  },
  'dominance+steadiness': {
    id: 'ds', badge: '⚙️ 穩健執行者', badgeEn: 'Steady Achiever', color: '#dd6b20',
    desc: '您目標導向、行動果決，同時也重視穩定與可靠——不是衝了就算，而是說到做到。您傾向設定明確目標後，用穩紮穩打的方式一步步達成，是團隊中「講了就會做到」的角色。',
    advice: '這個組合讓您兼具推進力與可靠度，適合帶領需要長期投入的專案；與步調較快、重靈感的 I 型夥伴合作時，可以多給彼此一些彈性空間，避免節奏感落差造成摩擦。',
  },
  'conscientiousness+dominance': {
    id: 'dc', badge: '🎯 策略決斷者', badgeEn: 'Strategic Driver', color: '#c53030',
    desc: '您做決定果斷，但不是憑衝動——而是有邏輯、有依據的果斷。您重視效率也重視品質，習慣先把問題想清楚再快速執行，是能在壓力下做出精準判斷的角色。',
    advice: '您的組合在需要快速且正確決策的場合特別有價值；與重視關係經營、步調較慢的 S 型或 I 型夥伴合作時，記得多花一點時間說明「為什麼」，而不只是「做什麼」。',
  },
  'influence+steadiness': {
    id: 'is', badge: '🤝 溫暖凝聚者', badgeEn: 'Warm Connector', color: '#38a169',
    desc: '您善於營造正向氣氛，同時也重視關係的穩定與和諧。您很自然地成為團隊裡的潤滑劑，既能炒熱氣氛，也懂得照顧每個人的情緒，讓團隊保持凝聚力。',
    advice: '這個組合讓您很適合擔任團隊的橋樑角色；面對重目標、步調快的 D 型夥伴時，可以練習更直接地表達自己的立場，避免因為顧全和諧而讓想法被忽略。',
  },
  'conscientiousness+influence': {
    id: 'ic', badge: '💬 精準表達者', badgeEn: 'Articulate Analyst', color: '#805ad5',
    desc: '您善於溝通，也重視邏輯與細節——能把複雜的想法講得清楚易懂，是「既會講、又講得準」的組合。您習慣把想法整理成有條理的架構，再用生動的方式傳達出去。',
    advice: '這個組合很適合擔任需要對外溝通專業內容的角色；與重視直覺行動、不喜歡等待的 D 型夥伴合作時，記得掌握好說明的長度，抓重點先講、細節後補。',
  },
  'conscientiousness+steadiness': {
    id: 'sc', badge: '🛡️ 可靠守護者', badgeEn: 'Reliable Guardian', color: '#2c5282',
    desc: '您耐心細膩、重視流程與品質，是團隊裡最讓人放心託付事情的角色。您不追求快，但求穩、求對，習慣把每個細節都確認清楚才放行。',
    advice: '這個組合是團隊穩定運作的重要基石；與步調快、重結果的 D 型或善於臨場應變的 I 型夥伴合作時，可以練習在確保品質的前提下，適度加快回應與決策的速度。',
  },
  default: {
    id: 'balanced', badge: '⚖️ 均衡風格', badgeEn: 'Balanced Profile', color: '#718096',
    desc: '您在四種行為風格上的表現相當平均，沒有特別突出的單一傾向——這代表您能視情境彈性切換風格，適應力很強。',
    advice: '善用您的彈性，觀察不同情境下哪種風格最合適，並留意在團隊中主動說明自己當下採取的是哪種應對方式，讓其他人更容易理解你的節奏。',
  },
};

// 給 PrintableReport／aggregateStats 等既有元件使用：以陣列形式列出全部風格
// 組合（不含 default 防呆項），元件不需要另外判斷 PROFILE_MODE 就能運作
// （PrintableReport 的落點對照表沒有 min/max 時會自動省略分數區間，見該元件）。
export const LEVELS = Object.entries(PROFILES)
  .filter(([key]) => key !== 'default')
  .map(([, level]) => level);

/**
 * DISC 是行為風格而非能力高低，因此不用「精熟／萌芽」這種暗示好壞的字眼，
 * 改用中性的「傾向強弱」描述這個風格在受測者身上表現得多明顯。
 */
export function dimensionRating(average) {
  if (average >= 4.2) return { label: '非常明顯', tone: 'strong' };
  if (average >= 3.4) return { label: '明顯', tone: 'good' };
  if (average >= 2.6) return { label: '中等', tone: 'mid' };
  if (average >= 1.8) return { label: '較不明顯', tone: 'low' };
  return { label: '不明顯', tone: 'weak' };
}

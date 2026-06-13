export const ID = 'leadership-9d';
export const NAME = '經贏® 領導力九大構面行為評量';
export const DESCRIPTION = '9 大構面、90 題，含反向題（🔄）';

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
    id: 'communication', index: 1, name: '溝通力', subtitle: 'Communication', color: '#3182ce',
    questions: [
      { id: 'l1',  text: '我能清楚解釋複雜的內容，讓對方容易理解。', reversed: false },
      { id: 'l2',  text: '我會在對話中主動確認雙方是否理解一致。', reversed: false },
      { id: 'l3',  text: '我能依聽眾的背景調整我的溝通方式。', reversed: false },
      { id: 'l4',  text: '我在重要溝通前會先整理重點。', reversed: false },
      { id: 'l5',  text: '我能以尊重的方式提出不同意見。', reversed: false },
      { id: 'l6',  text: '我聽別人說話時能抓住真正的重點。', reversed: false },
      { id: 'l7',  text: '我會透過提問讓對方說得更清楚。', reversed: false },
      { id: 'l8',  text: '我在會議中能有效統整大家的觀點。', reversed: false },
      { id: 'l9',  text: '我常在對話中打斷對方的發言。', reversed: true },
      { id: 'l10', text: '我時常忽略別人話語中的細節或情緒。', reversed: true },
    ],
  },
  {
    id: 'collaboration', index: 2, name: '協作關係', subtitle: 'Collaboration', color: '#38a169',
    questions: [
      { id: 'l11', text: '我能在團隊中建立信任與合作的氛圍。', reversed: false },
      { id: 'l12', text: '我願意主動協助同事完成共同目標。', reversed: false },
      { id: 'l13', text: '我能有效處理團隊間的衝突。', reversed: false },
      { id: 'l14', text: '我會分享資訊提升團隊效率。', reversed: false },
      { id: 'l15', text: '我能協助團隊整合不同意見。', reversed: false },
      { id: 'l16', text: '團隊遇到困難時，我會主動支持同事。', reversed: false },
      { id: 'l17', text: '我能與跨部門保持良好合作。', reversed: false },
      { id: 'l18', text: '我願意給予他人正向回饋。', reversed: false },
      { id: 'l19', text: '我在團隊中常選擇保持距離、不多參與。', reversed: true },
      { id: 'l20', text: '當團隊意見不一致時，我通常選擇沉默不處理。', reversed: true },
    ],
  },
  {
    id: 'task-management', index: 3, name: '任務管理', subtitle: 'Task Management', color: '#dd6b20',
    questions: [
      { id: 'l21', text: '我能有效安排時間並掌握工作節奏。', reversed: false },
      { id: 'l22', text: '我會根據重要性與急迫性調整優先順序。', reversed: false },
      { id: 'l23', text: '我能清楚拆解任務並規畫執行步驟。', reversed: false },
      { id: 'l24', text: '我會事先釐清任務要求避免重工。', reversed: false },
      { id: 'l25', text: '我能準時完成上級交辦事項。', reversed: false },
      { id: 'l26', text: '我能追蹤並維持多項任務的進度。', reversed: false },
      { id: 'l27', text: '當遇到阻礙時，我能快速調整計畫。', reversed: false },
      { id: 'l28', text: '我會在完成任務後檢視執行品質。', reversed: false },
      { id: 'l29', text: '我常因為拖延而壓縮任務完成時間。', reversed: true },
      { id: 'l30', text: '我對於計畫中的變動常感到混亂難以因應。', reversed: true },
    ],
  },
  {
    id: 'execution', index: 4, name: '執行力', subtitle: 'Execution', color: '#d53f8c',
    questions: [
      { id: 'l31', text: '我會主動採取行動，不等待他人提醒。', reversed: false },
      { id: 'l32', text: '我能在有限資訊下做出合理決定。', reversed: false },
      { id: 'l33', text: '我能快速處理突發狀況。', reversed: false },
      { id: 'l34', text: '我會在關鍵時刻勇於承擔任務。', reversed: false },
      { id: 'l35', text: '我能持續推動任務直到完成。', reversed: false },
      { id: 'l36', text: '我能協助他人排除執行中遇到的障礙。', reversed: false },
      { id: 'l37', text: '我會以成果為導向要求自己的表現。', reversed: false },
      { id: 'l38', text: '我能在壓力下維持穩定的執行品質。', reversed: false },
      { id: 'l39', text: '面對困難任務時，我常選擇暫時逃避。', reversed: true },
      { id: 'l40', text: '我時常需要別人提醒才會開始著手工作。', reversed: true },
    ],
  },
  {
    id: 'leadership-impact', index: 5, name: '領導影響力', subtitle: 'Leadership Impact', color: '#805ad5',
    questions: [
      { id: 'l41', text: '我能為團隊設定具體且有方向性的目標。', reversed: false },
      { id: 'l42', text: '我能清楚說明每項任務的重要性。', reversed: false },
      { id: 'l43', text: '我會依據不同成員調整帶領方式。', reversed: false },
      { id: 'l44', text: '我能有效授權並信任團隊成員。', reversed: false },
      { id: 'l45', text: '我會提供具體回饋協助他人改善表現。', reversed: false },
      { id: 'l46', text: '我能協助團隊找到更有效率的工作方式。', reversed: false },
      { id: 'l47', text: '我能在困難時成為團隊的穩定力量。', reversed: false },
      { id: 'l48', text: '我能激勵團隊投入並保持士氣。', reversed: false },
      { id: 'l49', text: '我常避免處理績效不佳或敏感的問題。', reversed: true },
      { id: 'l50', text: '我對團隊方向的掌握常感到不確定。', reversed: true },
    ],
  },
  {
    id: 'developing-others', index: 6, name: '人才發展', subtitle: 'Developing Others', color: '#319795',
    questions: [
      { id: 'l51', text: '我會主動指導同事並分享經驗。', reversed: false },
      { id: 'l52', text: '我能提供實務建議協助他人成長。', reversed: false },
      { id: 'l53', text: '我會根據成員特性安排適合的任務。', reversed: false },
      { id: 'l54', text: '我能協助同事設定可達成的成長目標。', reversed: false },
      { id: 'l55', text: '我願意投入時間培育後備人才。', reversed: false },
      { id: 'l56', text: '我會觀察並肯定成員的努力與進步。', reversed: false },
      { id: 'l57', text: '我會提出具體回饋促進學習。', reversed: false },
      { id: 'l58', text: '我能激發他人願意挑戰更高的目標。', reversed: false },
      { id: 'l59', text: '我不太喜歡也不太習慣擔任指導別人的角色。', reversed: true },
      { id: 'l60', text: '我通常只關注自己的工作，不太投入他人的成長。', reversed: true },
    ],
  },
  {
    id: 'critical-thinking', index: 7, name: '思辨與決策', subtitle: 'Critical Thinking', color: '#2c7a7b',
    questions: [
      { id: 'l61', text: '我能從多角度分析問題。', reversed: false },
      { id: 'l62', text: '我會以數據或證據支持決策。', reversed: false },
      { id: 'l63', text: '我能分辨資訊的可靠程度。', reversed: false },
      { id: 'l64', text: '我能拆解複雜問題成可處理的部分。', reversed: false },
      { id: 'l65', text: '我能預測不同決策的後續影響。', reversed: false },
      { id: 'l66', text: '我能察覺自己思考中的偏誤。', reversed: false },
      { id: 'l67', text: '我能整合不同資訊形成合理結論。', reversed: false },
      { id: 'l68', text: '我能在模糊情況下保持冷靜思考。', reversed: false },
      { id: 'l69', text: '我常依直覺做決定而未充分思考。', reversed: true },
      { id: 'l70', text: '面對複雜問題時，我容易感到混亂而停滯。', reversed: true },
    ],
  },
  {
    id: 'self-development', index: 8, name: '自我成長', subtitle: 'Self-Development', color: '#c05621',
    questions: [
      { id: 'l71', text: '我會主動尋求學習以提升能力。', reversed: false },
      { id: 'l72', text: '我能在壓力下維持心理穩定。', reversed: false },
      { id: 'l73', text: '我會設定自己的成長目標。', reversed: false },
      { id: 'l74', text: '我願意接受他人回饋並調整行為。', reversed: false },
      { id: 'l75', text: '我能管理自己的情緒避免影響工作。', reversed: false },
      { id: 'l76', text: '我願意挑戰自己的舒適圈。', reversed: false },
      { id: 'l77', text: '我會反思過去表現並尋求改善。', reversed: false },
      { id: 'l78', text: '我能持續維持自律的工作習慣。', reversed: false },
      { id: 'l79', text: '面對失敗時，我常難以重新振作。', reversed: true },
      { id: 'l80', text: '我傾向忽略自己的學習需求。', reversed: true },
    ],
  },
  {
    id: 'succession-readiness', index: 9, name: '接班成熟度', subtitle: 'Succession Readiness', color: '#744210',
    questions: [
      { id: 'l81', text: '我認同企業的使命並願意延續它。', reversed: false },
      { id: 'l82', text: '我能與家族成員進行有效經營溝通。', reversed: false },
      { id: 'l83', text: '我願意承擔接班所需的責任。', reversed: false },
      { id: 'l84', text: '我已為接班的壓力建立基本心理準備。', reversed: false },
      { id: 'l85', text: '我認為企業未來與我的目標緊密相關。', reversed: false },
      { id: 'l86', text: '我願意投入時間熟悉經營能力。', reversed: false },
      { id: 'l87', text: '我能看見接班角色的意義與價值。', reversed: false },
      { id: 'l88', text: '我能理解並協調世代間的差異。', reversed: false },
      { id: 'l89', text: '我對企業未來沒有明確方向或連結感。', reversed: true },
      { id: 'l90', text: '我對接班的責任感到排斥或逃避。', reversed: true },
    ],
  },
];

export const ALL_QUESTIONS = DIMENSIONS.flatMap((d) => d.questions);
export const TOTAL_QUESTIONS = ALL_QUESTIONS.length;
export const MIN_SCORE = TOTAL_QUESTIONS * SCALE_MIN;
export const MAX_SCORE = TOTAL_QUESTIONS * SCALE_MAX;

export const LEVELS = [
  {
    id: 'explorer', min: 90, max: 225,
    badge: '🌱 領導探索期', badgeEn: 'Explorer', color: '#38a169',
    desc: '您正處於領導力的起步階段，在部分構面已有初步的行為基礎，但整體表現仍有較大的成長空間。這是一個寶貴的覺察起點，了解自己目前的行為模式，有助於規劃更有針對性的學習路徑。',
    advice: '建議從「溝通力」與「任務管理」這兩大基礎構面開始強化，培養清晰表達與有效規劃的日常習慣。找一位值得信任的導師，透過定期反思與回饋加速成長。',
  },
  {
    id: 'developer', min: 226, max: 315,
    badge: '📈 領導發展期', badgeEn: 'Developer', color: '#3182ce',
    desc: '您已具備一定的領導行為基礎，並在多個構面展現出穩定的表現。但在高壓情境、跨部門協作或人才發展等進階領域，仍有提升空間。',
    advice: '此階段最重要的是刻意練習「領導影響力」與「人才發展」，學習依據情境靈活調整領導風格，並主動建立回饋文化，幫助團隊持續成長。',
  },
  {
    id: 'proficient', min: 316, max: 405,
    badge: '🚀 領導精熟期', badgeEn: 'Proficient', color: '#805ad5',
    desc: '您在大多數領導構面都有優秀的行為表現，能夠有效帶領團隊面對挑戰、激發潛能。您的決策品質與溝通能力已受到認可，也展現出培育他人的意願與能力。',
    advice: '下一步是精煉「接班成熟度」與「思辨決策」能力，培養更宏觀的組織視野，並主動承擔更複雜的跨部門任務，以準備進入更高階的領導角色。',
  },
  {
    id: 'leader', min: 406, max: 450,
    badge: '👑 卓越領導者', badgeEn: 'Exceptional Leader', color: '#d69e2e',
    desc: '您展現出卓越的全方位領導力！九大構面均有高度成熟的行為表現，不僅能帶動團隊、培育人才，更具備高度的自我覺察與組織承擔精神，是組織中不可多得的領導典範。',
    advice: '以您的領導高度，建議聚焦於組織文化塑造與接班人培育，並將自身的領導智慧系統化，透過教練、輔導等方式影響更多人，持續擴大正向影響力。',
  },
];

export function dimensionRating(average) {
  if (average >= 4.2) return { label: '精熟', tone: 'strong' };
  if (average >= 3.4) return { label: '熟練', tone: 'good' };
  if (average >= 2.6) return { label: '發展中', tone: 'mid' };
  if (average >= 1.8) return { label: '萌芽', tone: 'low' };
  return { label: '待啟蒙', tone: 'weak' };
}

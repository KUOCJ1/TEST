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
    subDimensions: [
      { id: 'listening', name: '聆聽他人' },
      { id: 'processing', name: '處理訊息' },
      { id: 'expressing', name: '有效地溝通' },
    ],
    questions: [
      { id: 'l1',  text: '我能清楚解釋複雜的內容，讓對方容易理解。', reversed: false, subId: 'expressing' },
      { id: 'l2',  text: '我會在對話中主動確認雙方是否理解一致。', reversed: false, subId: 'processing' },
      { id: 'l3',  text: '我能依聽眾的背景調整我的溝通方式。', reversed: false, subId: 'expressing' },
      { id: 'l4',  text: '我在重要溝通前會先整理重點。', reversed: false, subId: 'processing' },
      { id: 'l5',  text: '我能以尊重的方式提出不同意見。', reversed: false, subId: 'expressing' },
      { id: 'l6',  text: '我聽別人說話時能抓住真正的重點。', reversed: false, subId: 'listening' },
      { id: 'l7',  text: '我會透過提問讓對方說得更清楚。', reversed: false, subId: 'listening' },
      { id: 'l8',  text: '我在會議中能有效統整大家的觀點。', reversed: false, subId: 'processing' },
      { id: 'l9',  text: '我常在對話中打斷對方的發言。', reversed: true, subId: 'listening' },
      { id: 'l10', text: '我時常忽略別人話語中的細節或情緒。', reversed: true, subId: 'listening' },
    ],
  },
  {
    id: 'collaboration', index: 2, name: '協作關係', subtitle: 'Collaboration', color: '#38a169',
    subDimensions: [
      { id: 'build-relations', name: '建立人員關係' },
      { id: 'lead-team', name: '引領團隊成功' },
    ],
    questions: [
      { id: 'l11', text: '我能在團隊中建立信任與合作的氛圍。', reversed: false, subId: 'build-relations' },
      { id: 'l12', text: '我願意主動協助同事完成共同目標。', reversed: false, subId: 'build-relations' },
      { id: 'l13', text: '我能有效處理團隊間的衝突。', reversed: false, subId: 'lead-team' },
      { id: 'l14', text: '我會分享資訊提升團隊效率。', reversed: false, subId: 'lead-team' },
      { id: 'l15', text: '我能協助團隊整合不同意見。', reversed: false, subId: 'lead-team' },
      { id: 'l16', text: '團隊遇到困難時，我會主動支持同事。', reversed: false, subId: 'build-relations' },
      { id: 'l17', text: '我能與跨部門保持良好合作。', reversed: false, subId: 'build-relations' },
      { id: 'l18', text: '我願意給予他人正向回饋。', reversed: false, subId: 'build-relations' },
      { id: 'l19', text: '我在團隊中常選擇保持距離、不多參與。', reversed: true, subId: 'build-relations' },
      { id: 'l20', text: '當團隊意見不一致時，我通常選擇沉默不處理。', reversed: true, subId: 'lead-team' },
    ],
  },
  {
    id: 'task-management', index: 3, name: '任務管理', subtitle: 'Task Management', color: '#dd6b20',
    subDimensions: [
      { id: 'efficiency', name: '工作效率' },
      { id: 'competence', name: '勝任工作' },
    ],
    questions: [
      { id: 'l21', text: '我能有效安排時間並掌握工作節奏。', reversed: false, subId: 'efficiency' },
      { id: 'l22', text: '我會根據重要性與急迫性調整優先順序。', reversed: false, subId: 'efficiency' },
      { id: 'l23', text: '我能清楚拆解任務並規畫執行步驟。', reversed: false, subId: 'efficiency' },
      { id: 'l24', text: '我會事先釐清任務要求避免重工。', reversed: false, subId: 'competence' },
      { id: 'l25', text: '我能準時完成上級交辦事項。', reversed: false, subId: 'competence' },
      { id: 'l26', text: '我能追蹤並維持多項任務的進度。', reversed: false, subId: 'efficiency' },
      { id: 'l27', text: '當遇到阻礙時，我能快速調整計畫。', reversed: false, subId: 'competence' },
      { id: 'l28', text: '我會在完成任務後檢視執行品質。', reversed: false, subId: 'competence' },
      { id: 'l29', text: '我常因為拖延而壓縮任務完成時間。', reversed: true, subId: 'efficiency' },
      { id: 'l30', text: '我對於計畫中的變動常感到混亂難以因應。', reversed: true, subId: 'competence' },
    ],
  },
  {
    id: 'execution', index: 4, name: '執行力', subtitle: 'Execution', color: '#d53f8c',
    subDimensions: [
      { id: 'take-action', name: '採取行動' },
      { id: 'create-results', name: '創造結果' },
    ],
    questions: [
      { id: 'l31', text: '我會主動採取行動，不等待他人提醒。', reversed: false, subId: 'take-action' },
      { id: 'l32', text: '我能在有限資訊下做出合理決定。', reversed: false, subId: 'take-action' },
      { id: 'l33', text: '我能快速處理突發狀況。', reversed: false, subId: 'take-action' },
      { id: 'l34', text: '我會在關鍵時刻勇於承擔任務。', reversed: false, subId: 'take-action' },
      { id: 'l35', text: '我能持續推動任務直到完成。', reversed: false, subId: 'create-results' },
      { id: 'l36', text: '我能協助他人排除執行中遇到的障礙。', reversed: false, subId: 'create-results' },
      { id: 'l37', text: '我會以成果為導向要求自己的表現。', reversed: false, subId: 'create-results' },
      { id: 'l38', text: '我能在壓力下維持穩定的執行品質。', reversed: false, subId: 'create-results' },
      { id: 'l39', text: '面對困難任務時，我常選擇暫時逃避。', reversed: true, subId: 'take-action' },
      { id: 'l40', text: '我時常需要別人提醒才會開始著手工作。', reversed: true, subId: 'take-action' },
    ],
  },
  {
    id: 'leadership-impact', index: 5, name: '領導影響力', subtitle: 'Leadership Impact', color: '#805ad5',
    subDimensions: [
      { id: 'trust', name: '讓人信任' },
      { id: 'direction', name: '提供方向' },
      { id: 'delegation', name: '授權委責' },
    ],
    questions: [
      { id: 'l41', text: '我能為團隊設定具體且有方向性的目標。', reversed: false, subId: 'direction' },
      { id: 'l42', text: '我能清楚說明每項任務的重要性。', reversed: false, subId: 'direction' },
      { id: 'l43', text: '我會依據不同成員調整帶領方式。', reversed: false, subId: 'delegation' },
      { id: 'l44', text: '我能有效授權並信任團隊成員。', reversed: false, subId: 'delegation' },
      { id: 'l45', text: '我會提供具體回饋協助他人改善表現。', reversed: false, subId: 'delegation' },
      { id: 'l46', text: '我能協助團隊找到更有效率的工作方式。', reversed: false, subId: 'direction' },
      { id: 'l47', text: '我能在困難時成為團隊的穩定力量。', reversed: false, subId: 'trust' },
      { id: 'l48', text: '我能激勵團隊投入並保持士氣。', reversed: false, subId: 'trust' },
      { id: 'l49', text: '我常避免處理績效不佳或敏感的問題。', reversed: true, subId: 'trust' },
      { id: 'l50', text: '我對團隊方向的掌握常感到不確定。', reversed: true, subId: 'direction' },
    ],
  },
  {
    id: 'developing-others', index: 6, name: '人才發展', subtitle: 'Developing Others', color: '#319795',
    subDimensions: [
      { id: 'cultivate', name: '培養個人才能' },
      { id: 'motivate', name: '激勵成功' },
    ],
    questions: [
      { id: 'l51', text: '我會主動指導同事並分享經驗。', reversed: false, subId: 'cultivate' },
      { id: 'l52', text: '我能提供實務建議協助他人成長。', reversed: false, subId: 'cultivate' },
      { id: 'l53', text: '我會根據成員特性安排適合的任務。', reversed: false, subId: 'cultivate' },
      { id: 'l54', text: '我能協助同事設定可達成的成長目標。', reversed: false, subId: 'cultivate' },
      { id: 'l55', text: '我願意投入時間培育後備人才。', reversed: false, subId: 'cultivate' },
      { id: 'l56', text: '我會觀察並肯定成員的努力與進步。', reversed: false, subId: 'motivate' },
      { id: 'l57', text: '我會提出具體回饋促進學習。', reversed: false, subId: 'cultivate' },
      { id: 'l58', text: '我能激發他人願意挑戰更高的目標。', reversed: false, subId: 'motivate' },
      { id: 'l59', text: '我不太喜歡也不太習慣擔任指導別人的角色。', reversed: true, subId: 'cultivate' },
      { id: 'l60', text: '我通常只關注自己的工作，不太投入他人的成長。', reversed: true, subId: 'motivate' },
    ],
  },
  {
    id: 'critical-thinking', index: 7, name: '思辨與決策', subtitle: 'Critical Thinking', color: '#2c7a7b',
    subDimensions: [
      { id: 'analysis', name: '分析判斷' },
      { id: 'decisiveness', name: '決策定見' },
    ],
    questions: [
      { id: 'l61', text: '我能從多角度分析問題。', reversed: false, subId: 'analysis' },
      { id: 'l62', text: '我會以數據或證據支持決策。', reversed: false, subId: 'analysis' },
      { id: 'l63', text: '我能分辨資訊的可靠程度。', reversed: false, subId: 'analysis' },
      { id: 'l64', text: '我能拆解複雜問題成可處理的部分。', reversed: false, subId: 'analysis' },
      { id: 'l65', text: '我能預測不同決策的後續影響。', reversed: false, subId: 'decisiveness' },
      { id: 'l66', text: '我能察覺自己思考中的偏誤。', reversed: false, subId: 'decisiveness' },
      { id: 'l67', text: '我能整合不同資訊形成合理結論。', reversed: false, subId: 'analysis' },
      { id: 'l68', text: '我能在模糊情況下保持冷靜思考。', reversed: false, subId: 'decisiveness' },
      { id: 'l69', text: '我常依直覺做決定而未充分思考。', reversed: true, subId: 'decisiveness' },
      { id: 'l70', text: '面對複雜問題時，我容易感到混亂而停滯。', reversed: true, subId: 'decisiveness' },
    ],
  },
  {
    id: 'self-development', index: 8, name: '自我成長', subtitle: 'Self-Development', color: '#c05621',
    subDimensions: [
      { id: 'commitment', name: '展現承諾' },
      { id: 'improvement', name: '尋求改善' },
    ],
    questions: [
      { id: 'l71', text: '我會主動尋求學習以提升能力。', reversed: false, subId: 'improvement' },
      { id: 'l72', text: '我能在壓力下維持心理穩定。', reversed: false, subId: 'commitment' },
      { id: 'l73', text: '我會設定自己的成長目標。', reversed: false, subId: 'improvement' },
      { id: 'l74', text: '我願意接受他人回饋並調整行為。', reversed: false, subId: 'improvement' },
      { id: 'l75', text: '我能管理自己的情緒避免影響工作。', reversed: false, subId: 'commitment' },
      { id: 'l76', text: '我願意挑戰自己的舒適圈。', reversed: false, subId: 'improvement' },
      { id: 'l77', text: '我會反思過去表現並尋求改善。', reversed: false, subId: 'improvement' },
      { id: 'l78', text: '我能持續維持自律的工作習慣。', reversed: false, subId: 'commitment' },
      { id: 'l79', text: '面對失敗時，我常難以重新振作。', reversed: true, subId: 'commitment' },
      { id: 'l80', text: '我傾向忽略自己的學習需求。', reversed: true, subId: 'improvement' },
    ],
  },
  {
    id: 'succession-readiness', index: 9, name: '接班成熟度', subtitle: 'Succession Readiness', color: '#744210',
    subDimensions: [
      { id: 'mission-commitment', name: '使命承諾' },
      { id: 'generational', name: '世代協作與準備' },
    ],
    questions: [
      { id: 'l81', text: '我認同企業的使命並願意延續它。', reversed: false, subId: 'mission-commitment' },
      { id: 'l82', text: '我能與家族成員進行有效經營溝通。', reversed: false, subId: 'generational' },
      { id: 'l83', text: '我願意承擔接班所需的責任。', reversed: false, subId: 'mission-commitment' },
      { id: 'l84', text: '我已為接班的壓力建立基本心理準備。', reversed: false, subId: 'generational' },
      { id: 'l85', text: '我認為企業未來與我的目標緊密相關。', reversed: false, subId: 'mission-commitment' },
      { id: 'l86', text: '我願意投入時間熟悉經營能力。', reversed: false, subId: 'generational' },
      { id: 'l87', text: '我能看見接班角色的意義與價值。', reversed: false, subId: 'generational' },
      { id: 'l88', text: '我能理解並協調世代間的差異。', reversed: false, subId: 'generational' },
      { id: 'l89', text: '我對企業未來沒有明確方向或連結感。', reversed: true, subId: 'mission-commitment' },
      { id: 'l90', text: '我對接班的責任感到排斥或逃避。', reversed: true, subId: 'generational' },
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

/**
 * 子能力評語庫 — 依子能力（subId）× 三個分段（high / mid / low）對應一句評語。
 * 分段門檻：平均 ≥4.5 → high；3.5–<4.5 → mid；<3.5 → low（見 utils/narrative.js 的 bandOf）。
 * 溝通／領導／建立關係／任務／執行／發展／個人 共 16 個子能力的語句沿用評分標準對應表；
 * 「思辨與決策」「接班成熟度」兩構面 PDF 未涵蓋，依相同三段語氣新撰，待審核調整。
 */
export const COMMENTARY = {
  // 溝通力
  listening: {
    high: '展現出高度同理與專注的傾聽能力，能創造安全的溝通氛圍，促進團隊信任',
    mid: '能在多數情境中傾聽他人觀點，有良好的互動基礎，具備穩定的溝通意願',
    low: '容易在對話中忽略對方想法，或不自覺地打斷他人，使雙方交流效果打折',
  },
  processing: {
    high: '能從複雜資訊中抓住重點，清晰歸納核心問題，展現出色的邏輯與分析力',
    mid: '能處理常規資訊並做出基本分析，在複雜情境中可進一步提升整合力',
    low: '訊息分析與判斷可能偏重主觀經驗，導致忽略關鍵資訊或全貌',
  },
  expressing: {
    high: '能有效傳遞訊息並適切調整表達方式，使溝通具影響力且易於理解',
    mid: '多數情況下能清楚表達觀點，與他人互動順暢，具備良好溝通基礎',
    low: '表達結構鬆散、重點不清，可能讓聽者難以理解或產生誤解',
  },
  // 領導影響力
  trust: {
    high: '以誠信與一致性贏得他人信賴，是團隊中值得依靠的穩定力量',
    mid: '展現基本誠信與責任感，在多數互動中能建立信任，值得長期發展',
    low: '在互動中若態度反覆、缺乏一致性，可能讓他人產生不安或信任感下降',
  },
  direction: {
    high: '清楚傳達願景並提供前進方向，能有效引導團隊聚焦在目標上',
    mid: '能說明工作目標並給予初步指引，團隊多能理解方向並有所回應',
    low: '若缺乏明確目標傳達或步驟規劃，團隊可能容易迷失方向或產生誤判',
  },
  delegation: {
    high: '能適切授權並信任團隊，自身角色聚焦於策略與成果引導',
    mid: '授權與交辦日益清晰，部分情境中回饋與放手仍可更為彈性',
    low: '對任務控制過度或角色模糊，可能壓抑他人主動性與團隊效能',
  },
  // 協作關係
  'build-relations': {
    high: '關注他人情緒並給予建設性回饋，營造尊重與包容的團隊文化',
    mid: '與同事互動融洽，能主動關心並提供支持，是穩定合作的夥伴',
    low: '人際互動若缺乏敏感度與關懷，可能導致信任斷裂與溝通不順',
  },
  'lead-team': {
    high: '能整合多樣觀點帶領團隊邁向共識，是團隊策略落實的推動者',
    mid: '具備基礎團隊引導經驗，能統整意見並促進行動方向一致',
    low: '若未積極凝聚共識與整合資源，可能削弱團隊動能與目標一致性',
  },
  // 任務管理
  efficiency: {
    high: '擅長優先排序與時間管理，能高效完成多項任務',
    mid: '能依時完成多數工作，具時間感與優先順序安排的意識',
    low: '任務安排未清，或時間與資源運用不當，容易造成效率低落或錯誤',
  },
  competence: {
    high: '展現良好的學習力與技術掌握，能迅速適應新挑戰與任務需求',
    mid: '能勝任既有任務，在學習新知與應用上逐步成長',
    low: '欠缺關鍵知識或技術靈活度，可能導致工作成果與預期水準落差',
  },
  // 執行力
  'take-action': {
    high: '是行動派的實踐者，能主動發起任務推進成果',
    mid: '多能按時啟動任務，具備主動推進的意識與行動意願',
    low: '面對任務猶豫或拖延，可能影響團隊進度與對即時主動性的觀感',
  },
  'create-results': {
    high: '持續帶領團隊突破困難、交出成果，是具實效導向的管理者',
    mid: '對結果有基本掌握與責任感，成效穩定但尚有成長空間',
    low: '對成果標準掌握不足，或執行過程缺乏節奏，可能難以展現績效',
  },
  // 人才發展
  cultivate: {
    high: '主動關心部屬發展，並提供具體協助與即時回饋',
    mid: '關注他人潛能，有意識進行協助與觀察，是潛在發展教練',
    low: '較少關注部屬的發展潛力或需求，容易錯失培養與提升的契機',
  },
  motivate: {
    high: '能發現他人優勢並鼓舞團隊氛圍，是能量的傳遞者',
    mid: '願意給予鼓勵與正向回饋，能帶動良好工作氣氛',
    low: '在團隊努力或成就出現時未即時回應，可能弱化成員的動力與參與感',
  },
  // 自我成長（個人發展）
  commitment: {
    high: '具備積極態度與強大續航力，持續朝目標邁進',
    mid: '多數情境中展現穩定投入與責任心，是團隊可倚賴的夥伴',
    low: '表現出投入感不穩定，或對目標缺乏熱忱時，團隊可能感受不到帶動力',
  },
  improvement: {
    high: '能虛心接納反饋並主動找方法改善，是持續成長的典範',
    mid: '具備持續改善意識，願意從回饋中做出修正與嘗試',
    low: '缺乏自我檢視與學習反思的習慣，可能讓問題重複發生而未被調整',
  },
  // 思辨與決策（全新撰寫）
  analysis: {
    high: '能從多角度拆解複雜問題、辨識資訊可靠度，並整合成清晰而有依據的結論',
    mid: '能針對常規問題進行合理分析，在高度複雜或模糊的情境中仍可強化全貌掌握',
    low: '分析時容易偏重單一角度或直覺，可能忽略關鍵證據而影響判斷品質',
  },
  decisiveness: {
    high: '能在資訊有限或壓力情境下保持冷靜，權衡後果並做出果斷而負責的決策',
    mid: '多能做出合理決定，面對高度不確定時仍可加強決斷速度與定見',
    low: '面對複雜或模糊情境時易猶豫或依直覺行事，可能錯失時機或反覆改變方向',
  },
  // 接班成熟度（全新撰寫）
  'mission-commitment': {
    high: '高度認同企業使命，主動承擔接班責任，並將個人目標與組織未來緊密連結',
    mid: '對接班角色已有基本認同與投入，仍可深化使命感與長期承諾的穩定度',
    low: '對接班責任的認同或方向感仍不明確，可能影響投入度與長期準備',
  },
  generational: {
    high: '能與家族及團隊有效溝通經營議題，協調世代差異，並為接班預作準備',
    mid: '已具備基本的經營溝通與世代協作意識，仍可主動累積經營歷練',
    low: '在世代溝通或經營準備上著力較少，面對接班壓力的心理與能力準備仍待補強',
  },
};

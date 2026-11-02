// 領導力 360° 行為評量（70 題）：客戶專案（森永高階教練 360 評鑑）使用的題庫。
//
// 題目文字取自客戶提供的 Google 表單（70 題、1–5 分、全部正向敘述、沒有反向題），題號 l1–l70 與表單的
// 「1.」到「70.」一一對應，所以表單匯出的欄位可以直接批次上傳。構面與子能力的分組是依題目主題整理的
// 暫定版（表單本身沒有構面資訊），客戶有正式分組時改這個檔案即可，不影響原始作答（答案以題號保存）。
//
// 不在公開的評測工具庫展示（LIBRARY_HIDDEN）；只有教練、管理員，以及「班級使用這份評量」的成員看得到
// （見 server/src/routes/assessments.js 的 hidden 規則）。

export const ID = 'leadership-360-70';
export const SUPPORTS_360 = true;
export const LIBRARY_HIDDEN = true;
export const NAME = '領導力 360° 行為評量（70 題）';
export const NAME_EN = 'Leadership 360° Behavioral Assessment (70 items)';
export const ABBR = 'L360';
export const DESCRIPTION = '以 70 題行為描述，從傾聽、溝通、誠信、規劃授權、應變創新、團隊、願景資源、學習成長、執行成果與教練激勵 10 個構面，整合自評與主管、同儕、部屬的他評，適用於中高階管理者與教練的發展回饋。';
// 360° 他評頁「您正在評估「王小明」＿＿」的語尾。
export const RATER_PROMPT = '的領導力行為表現';

export const SCALE_MIN = 1;
export const SCALE_MAX = 5;
// 原表單只有 1–5 的數字、沒有文字說明；這裡的說法是暫定值（與 L9D 一致的同意度量表），客戶有正式說法時再改。
export const SCALE_LABELS = [
  { value: 1, label: '非常不符合' },
  { value: 2, label: '不太符合' },
  { value: 3, label: '普通' },
  { value: 4, label: '大致符合' },
  { value: 5, label: '非常符合' },
];

export const DIMENSIONS = [
  {
    id: 'listening-judgment', index: 1, name: '傾聽與判斷', subtitle: 'Listening & Judgment', color: '#3182ce',
    subDimensions: [
      { id: 'listening', name: '傾聽與徵詢' },
      { id: 'analysis', name: '分析與判斷' },
    ],
    questions: [
      { id: 'l1', text: '向他人徵求想法、意見與建議', reversed: false, subId: 'listening' },
      { id: 'l2', text: '創造一個可以公開討論議題的環境', reversed: false, subId: 'listening' },
      { id: 'l3', text: '願意開放心胸的聆聽更多意見', reversed: false, subId: 'listening' },
      { id: 'l4', text: '總是仔細地聆聽不會打斷他人', reversed: false, subId: 'listening' },
      { id: 'l5', text: '能總結他人意見，並確認理解是否正確', reversed: false, subId: 'listening' },
      { id: 'l6', text: '能夠辨識議題的核心要素有哪些', reversed: false, subId: 'analysis' },
      { id: 'l7', text: '作決定能考慮優缺點、短中長期的結果', reversed: false, subId: 'analysis' },
      { id: 'l8', text: '能依邏輯處理訊息，並得出清楚的結論', reversed: false, subId: 'analysis' },
    ],
  },
  {
    id: 'expression', index: 2, name: '溝通表達', subtitle: 'Expression', color: '#319795',
    subDimensions: [],
    questions: [
      { id: 'l9', text: '能將想法清楚地寫出來', reversed: false },
      { id: 'l10', text: '是一個有說話有架構及令人印象深刻的演說者', reversed: false },
      { id: 'l11', text: '認真仔細地描述一件事不誇飾', reversed: false },
      { id: 'l12', text: '有話直說的溝通方式，即使在處理敏感的議題上', reversed: false },
    ],
  },
  {
    id: 'integrity', index: 3, name: '誠信與可信賴', subtitle: 'Integrity & Trust', color: '#2f855a',
    subDimensions: [],
    questions: [
      { id: 'l13', text: '能夠準備好目前工作相關資訊，讓相關人員可以使用', reversed: false },
      { id: 'l14', text: '總是信守承諾', reversed: false },
      { id: 'l15', text: '是可以被託付機密資訊的人', reversed: false },
      { id: 'l16', text: '與他人互動是坦誠的', reversed: false },
      { id: 'l17', text: '展現高道德標準', reversed: false },
    ],
  },
  {
    id: 'planning-delegation', index: 4, name: '規劃與授權', subtitle: 'Planning & Delegation', color: '#dd6b20',
    subDimensions: [
      { id: 'planning', name: '規劃與期望設定' },
      { id: 'delegation', name: '授權與人員管理' },
    ],
    questions: [
      { id: 'l18', text: '說清楚自己期待', reversed: false, subId: 'planning' },
      { id: 'l19', text: '建立可管理的工作量', reversed: false, subId: 'planning' },
      { id: 'l20', text: '透過規劃循序漸進的步驟完成長期的目標', reversed: false, subId: 'planning' },
      { id: 'l21', text: '在執行細節工作時依然可聚焦在大方向上', reversed: false, subId: 'planning' },
      { id: 'l22', text: '知道何時交辦他人何時自我負責', reversed: false, subId: 'delegation' },
      { id: 'l23', text: '能適才適所的分配工作', reversed: false, subId: 'delegation' },
      { id: 'l24', text: '給予他人權限去獨完成工作，且能有效協助並管理目標/成果', reversed: false, subId: 'delegation' },
      { id: 'l25', text: '授權他人以發現具創意的問題解決方案', reversed: false, subId: 'delegation' },
      { id: 'l26', text: '因著不同的工作型態彈性調整人員管理', reversed: false, subId: 'delegation' },
    ],
  },
  {
    id: 'adaptive-innovation', index: 5, name: '應變與創新', subtitle: 'Adaptability & Innovation', color: '#d53f8c',
    subDimensions: [
      { id: 'adapting', name: '應變與變革' },
      { id: 'innovating', name: '創新' },
    ],
    questions: [
      { id: 'l27', text: '在多變的環境下，仍能遊刃有餘且自在地工作', reversed: false, subId: 'adapting' },
      { id: 'l28', text: '面對挫折，能有建設性的回應', reversed: false, subId: 'adapting' },
      { id: 'l29', text: '參與變革及為變化做好計畫', reversed: false, subId: 'adapting' },
      { id: 'l30', text: '以想像力和原創性來處理工作', reversed: false, subId: 'innovating' },
      { id: 'l31', text: '在組織中鼓勵創新', reversed: false, subId: 'innovating' },
      { id: 'l32', text: '願採取大膽且可控制的方案', reversed: false, subId: 'innovating' },
      { id: 'l33', text: '視阻礙為創新改變的契機', reversed: false, subId: 'innovating' },
    ],
  },
  {
    id: 'empathy-team', index: 6, name: '同理與團隊', subtitle: 'Empathy & Team', color: '#805ad5',
    subDimensions: [
      { id: 'empathy', name: '同理與人際' },
      { id: 'team', name: '壓力、衝突與團隊' },
    ],
    questions: [
      { id: 'l34', text: '關懷他人的感受', reversed: false, subId: 'empathy' },
      { id: 'l35', text: '對人員的用字與行為舉止上，不會存有偏見與刻板印象', reversed: false, subId: 'empathy' },
      { id: 'l36', text: '會給予婉轉與建設性的回饋 (criticism)', reversed: false, subId: 'empathy' },
      { id: 'l37', text: '在高工作壓力下仍然怡然自若', reversed: false, subId: 'team' },
      { id: 'l38', text: '公平地解決衝突', reversed: false, subId: 'team' },
      { id: 'l39', text: '創造團隊合作的氛圍以面對競爭', reversed: false, subId: 'team' },
      { id: 'l40', text: '在團隊中建立一致性的決策', reversed: false, subId: 'team' },
    ],
  },
  {
    id: 'vision-resources', index: 7, name: '願景與資源', subtitle: 'Vision & Resources', color: '#b7791f',
    subDimensions: [
      { id: 'vision', name: '願景與人才' },
      { id: 'resources', name: '資源與時間管理' },
    ],
    questions: [
      { id: 'l41', text: '領導團隊建立達成組織願景的目標', reversed: false, subId: 'vision' },
      { id: 'l42', text: '將有才能的人引進團隊中', reversed: false, subId: 'vision' },
      { id: 'l43', text: '在團隊中運用多樣才能及經驗的人，追求團隊最大利益', reversed: false, subId: 'vision' },
      { id: 'l44', text: '將現代科技運用在實際工作中，以尋求效率最大化', reversed: false, subId: 'resources' },
      { id: 'l45', text: '有效率地使用外部資源', reversed: false, subId: 'resources' },
      { id: 'l46', text: '避免工作拖延', reversed: false, subId: 'resources' },
      { id: 'l47', text: '將工作設立先後順序，並依循執行', reversed: false, subId: 'resources' },
    ],
  },
  {
    id: 'learning-growth', index: 8, name: '學習與成長', subtitle: 'Learning & Growth', color: '#2b6cb0',
    subDimensions: [
      { id: 'learning', name: '學習與知識' },
      { id: 'self-growth', name: '自我覺察與成長' },
    ],
    questions: [
      { id: 'l48', text: '掌握執行工作所需的基本知識、技能', reversed: false, subId: 'learning' },
      { id: 'l49', text: '能夠快速學習新知並運用在工作中', reversed: false, subId: 'learning' },
      { id: 'l50', text: '適當將新理論、方法融入企業運作', reversed: false, subId: 'learning' },
      { id: 'l68', text: '願意承認錯誤並從中學習到', reversed: false, subId: 'self-growth' },
      { id: 'l69', text: '願意接受建設性的批評', reversed: false, subId: 'self-growth' },
      { id: 'l70', text: '能找出並追蹤改善績效的資源', reversed: false, subId: 'self-growth' },
    ],
  },
  {
    id: 'execution-results', index: 9, name: '果決執行與成果', subtitle: 'Execution & Results', color: '#c05621',
    subDimensions: [
      { id: 'executing', name: '果決執行' },
      { id: 'results', name: '成果導向' },
    ],
    questions: [
      { id: 'l51', text: '知道何時該停止規劃並開始執行', reversed: false, subId: 'executing' },
      { id: 'l52', text: '能率先帶領讓事情發生', reversed: false, subId: 'executing' },
      { id: 'l53', text: '能果決處理問題', reversed: false, subId: 'executing' },
      { id: 'l54', text: '下決策可以精準即時', reversed: false, subId: 'executing' },
      { id: 'l55', text: '克服障礙以成功完成專案任務', reversed: false, subId: 'executing' },
      { id: 'l56', text: '能設定高標準給團隊並促使達到結果', reversed: false, subId: 'results' },
      { id: 'l57', text: '一般來說，可達到結果並對組織有正向影響', reversed: false, subId: 'results' },
    ],
  },
  {
    id: 'coaching-motivation', index: 10, name: '教練與激勵', subtitle: 'Coaching & Motivation', color: '#744210',
    subDimensions: [
      { id: 'coaching', name: '教練與發展他人' },
      { id: 'motivating', name: '肯定與感染力' },
    ],
    questions: [
      { id: 'l58', text: '是一位有耐心、能有效幫助或回饋他人(部屬)的教練', reversed: false, subId: 'coaching' },
      { id: 'l59', text: '提供他人訓練發展以強化技能發展及專業成長', reversed: false, subId: 'coaching' },
      { id: 'l60', text: '能針對他人的優勢及需求提供客觀的評價', reversed: false, subId: 'coaching' },
      { id: 'l61', text: '能提供即時的目標或工作進度管理時程，以供審視及追蹤', reversed: false, subId: 'coaching' },
      { id: 'l62', text: '對於高品質工作的產出給予認可', reversed: false, subId: 'motivating' },
      { id: 'l63', text: '當他人付出額外努力，願意發自內心感激', reversed: false, subId: 'motivating' },
      { id: 'l64', text: '能將熱情感染他人，以鼓勵及促進正向態度', reversed: false, subId: 'motivating' },
      { id: 'l65', text: '能一直維持在高活力的狀態', reversed: false, subId: 'motivating' },
      { id: 'l66', text: '對任務目標堅持不懈', reversed: false, subId: 'motivating' },
      { id: 'l67', text: '對未來展望保持正向的態度', reversed: false, subId: 'motivating' },
    ],
  },
];

export const ALL_QUESTIONS = DIMENSIONS.flatMap((d) => d.questions);
export const TOTAL_QUESTIONS = ALL_QUESTIONS.length;
export const MIN_SCORE = TOTAL_QUESTIONS * SCALE_MIN;
export const MAX_SCORE = TOTAL_QUESTIONS * SCALE_MAX;

// 落點門檻是總分的 50%／70%／90%（與 L9D 同比例），為暫定值，累積實際資料後再校準。
// 這是發展用的回饋，不是績效評等；名稱刻意用描述「目前行為表現的成熟度」。
export const LEVELS = [
  {
    id: 'emerging', min: 70, max: 175,
    badge: '🌱 起步發展', badgeEn: 'Emerging', color: '#38a169',
    desc: '多數面向的領導行為還在建立中，他人觀察到的穩定表現不多。這是聚焦少數行為、快速累積成功經驗的階段。',
    advice: '先挑 2 到 3 個最想改變的行為，請一兩位信任的同事定期給你具體回饋，一個月後再檢視。',
  },
  {
    id: 'developing', min: 176, max: 245,
    badge: '📈 穩定發展', badgeEn: 'Developing', color: '#3182ce',
    desc: '在多個面向已有穩定表現，但面向之間、以及不同觀察者之間的落差仍然明顯。',
    advice: '對照自評與他評的落差，優先處理「自己覺得做到、別人沒感受到」的行為，並找一位教練或導師對話。',
  },
  {
    id: 'proficient', min: 246, max: 315,
    badge: '🚀 成熟穩健', badgeEn: 'Proficient', color: '#805ad5',
    desc: '大多數面向表現成熟穩健，能被不同角色一致地感受到，並能帶動團隊。',
    advice: '把力氣放在最弱的一兩個面向，以及更高層次的影響力：培育接班人、建立團隊的做事方式。',
  },
  {
    id: 'exemplary', min: 316, max: 350,
    badge: '👑 表現卓越', badgeEn: 'Exemplary', color: '#d69e2e',
    desc: '各面向都有高度成熟、一致的行為表現，是他人眼中的榜樣。',
    advice: '留意「高分陷阱」：持續尋求挑戰性的回饋，並把自己的做法系統化，傳承給更多人。',
  },
];

export function dimensionRating(average) {
  if (average >= 4.2) return { label: '精熟', tone: 'strong' };
  if (average >= 3.4) return { label: '熟練', tone: 'good' };
  if (average >= 2.6) return { label: '發展中', tone: 'mid' };
  if (average >= 1.8) return { label: '萌芽', tone: 'low' };
  return { label: '待啟蒙', tone: 'weak' };
}

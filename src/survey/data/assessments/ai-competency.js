export const ID = 'ai-competency';
export const NAME = 'AI 全方位職能實戰課前評測';
export const DESCRIPTION = '6 大構面、37 題李克特量表（含反向題）';

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
    id: 'foundation', index: 1, name: '工具認知與基礎操作', subtitle: '基礎力', color: '#2b6cb0',
    questions: [
      { id: 'q1', text: '我能清晰分辨 ChatGPT、Gemini、Claude 等主流大語言模型各自的優勢。', reversed: false },
      { id: 'q2', text: '我擁有付費訂閱（或高頻率使用）至少一種進階 AI 工具的經驗。', reversed: false },
      { id: 'q3', text: '我經常使用 AI 進行日常的文字處理工作（如長文摘要、Email 撰寫）。', reversed: false },
      { id: 'q4', text: '我嘗試過使用 AI 進行文字以外的生成任務（如 Midjourney、Gamma 簡報）。', reversed: false },
      { id: 'q5', text: '當工作遇到新挑戰時，我第一個想到的解決方案是「先問問 AI 看看它能怎麼幫我」。', reversed: false },
      { id: 'q32', text: '就算公司導入了新的 AI 工具，我通常也提不起興趣去嘗試。', reversed: true },
    ],
  },
  {
    id: 'communication', index: 2, name: '提示詞工程與對話技巧', subtitle: '溝通力', color: '#2f855a',
    questions: [
      { id: 'q6', text: '我瞭解在撰寫提示詞時，必須明確給予 AI「角色設定」與「背景資訊」。', reversed: false },
      { id: 'q7', text: '我能熟練地在提示詞中加入「約束條件」（例如：限制字數、規定語氣）。', reversed: false },
      { id: 'q8', text: '當 AI 第一次給出的答案不夠完美時，我懂得如何透過「多輪對話」逐步修正。', reversed: false },
      { id: 'q9', text: '我知道如何建立與調整「自訂指令」，讓 AI 記住我的工作習慣。', reversed: false },
      { id: 'q10', text: '我掌握進階提示詞技巧（如 Few-Shot 範例、思維鏈），並會視任務難度選用具推理能力的模型（reasoning models）。', reversed: false },
      { id: 'q33', text: '我寫提示詞時常常一句話帶過，很少補充角色設定或背景資訊。', reversed: true },
    ],
  },
  {
    id: 'workflow', index: 3, name: '工作流程整合與知識管理', subtitle: '應用力', color: '#dd6b20',
    questions: [
      { id: 'q11', text: '我已經將 AI 工具常駐在我的日常工作分頁中，每天使用時間超過 30 分鐘。', reversed: false },
      { id: 'q12', text: '我知道如何利用 AI 協助我進行高效率的資料搜集、市場研究或競品分析。', reversed: false },
      { id: 'q13', text: '我正在使用「NotebookLM」等工具，上傳文件建立個人的 AI 專屬知識庫。', reversed: false },
      { id: 'q14', text: '我能運用 AI 協助工作流程的自動化（如使用 Make、Zapier 串接 AI）。', reversed: false },
      { id: 'q15', text: '我能用 AI 建立標準作業程序（SOP）或串聯多步驟工作流，並了解 AI Agent 可自主執行這類任務。', reversed: false },
      { id: 'q34', text: '除了偶爾問問題，AI 幾乎沒有真正進入我的日常工作流程。', reversed: true },
    ],
  },
  {
    id: 'collaboration', index: 4, name: '生成物件精緻化與跨模態應用', subtitle: '協作力', color: '#805ad5',
    questions: [
      { id: 'q16', text: '我不會直接複製貼上 AI 的內容，而是扮演總編輯角色進行二次修改。', reversed: false },
      { id: 'q17', text: '我能熟練使用 Canva Pro、Gamma 等工具快速產出具設計感的視覺物件。', reversed: false },
      { id: 'q18', text: '我能熟練運用 AI 的「多模態功能」（例如：上傳圖片或數據圖表讓 AI 分析）。', reversed: false },
      { id: 'q19', text: '我具備引導 AI 進行跨格式轉換的能力（如：文檔轉成 Markdown 或 Excel）。', reversed: false },
      { id: 'q20', text: '我曾使用 AI 協助進行影音企劃（如腳本編寫、分鏡規劃或影音生成）。', reversed: false },
      { id: 'q35', text: '我經常把 AI 生成的內容直接複製貼上交差，不太做二次修改。', reversed: true },
    ],
  },
  {
    id: 'innovation', index: 5, name: '專屬 AI 應用開發與客製化', subtitle: '創新力', color: '#d53f8c',
    questions: [
      { id: 'q21', text: '我擁有打造專屬 AI 助理（如 GPTs、Claude Projects、Gemini Gems）的經驗。', reversed: false },
      { id: 'q22', text: '我能為自己的 AI 助理設定「知識庫」並上傳有效文件，使其依我的資料回答。', reversed: false },
      { id: 'q23', text: '我懂得如何測試與優化自己開發的 AI 機器人，使其回覆品質穩定。', reversed: false },
      { id: 'q24', text: '我曾將自己做好的 GPTs 或 AI 工具分享給同事或團隊使用。', reversed: false },
      { id: 'q25', text: '我有持續關注 AI 領域的最新發展（如新模型發表、AI Agent 技術趨勢）。', reversed: false },
      { id: 'q36', text: '我覺得打造客製化 AI 應用太複雜，從沒想過要自己動手。', reversed: true },
    ],
  },
  {
    id: 'safety', index: 6, name: 'AI 資訊素養與風險管理', subtitle: '安全思維力', color: '#319795',
    questions: [
      { id: 'q26', text: '我對 AI 的「幻覺」保持高度警覺，關鍵數據都一定會人工核對。', reversed: false },
      { id: 'q27', text: '我從不將未公開的公司內部財務數據或客戶個資輸入到免費版 AI 中。', reversed: false },
      { id: 'q28', text: '我瞭解生成式 AI 的版權爭議，並知道如何在安全邊界內商業應用。', reversed: false },
      { id: 'q29', text: '面對鋪天蓋地的 AI 資訊，我能有效篩選辨識真偽，有系統地吸收。', reversed: false },
      { id: 'q30', text: '我不會因為過度依賴 AI 而喪失自己獨立思考與批判性思維的能力。', reversed: false },
      { id: 'q31', text: '我樂於與他人分享 AI 的使用心得，並推動周遭團隊提升 AI 素養。', reversed: false },
      { id: 'q37', text: '趕時間時，我會直接採用 AI 給的數據，先用了再說。', reversed: true },
    ],
  },
];

export const ALL_QUESTIONS = DIMENSIONS.flatMap((d) => d.questions);
export const TOTAL_QUESTIONS = ALL_QUESTIONS.length;
export const MIN_SCORE = TOTAL_QUESTIONS * SCALE_MIN;
export const MAX_SCORE = TOTAL_QUESTIONS * SCALE_MAX;

// 落點門檻依 37 題（總分 37–185）等比例切分為四級（≈40% / 60% / 80%）。
export const LEVELS = [
  {
    id: 'novice', min: 37, max: 74,
    badge: '🌱 AI 新手村', badgeEn: 'AI Novice', color: '#38a169',
    desc: '您對 AI 工具已有初步聽聞，但日常工作中較少主動使用。目前停留在「把 AI 當作更進階的 Google 搜尋」階段，有時會覺得 AI 回答不切實際或不知道該如何跟它對話。',
    advice: '萬丈高樓平地起！建議從大語言模型的操作介面與基礎提示詞架構（如設定角色、背景）開始學起，先培養每天讓 AI 幫忙寫 Email 或摘要長文的小習慣。',
  },
  {
    id: 'practitioner', min: 75, max: 111,
    badge: '📈 AI 應用實踐者', badgeEn: 'AI Practitioner', color: '#3182ce',
    desc: '您已經將 AI 融入部分日常工作，並掌握了基本的提示詞技巧，能透過對話讓 AI 產出可用的文字或圖片。但在處理複雜任務、跨工具串聯或打造自動化工作流上，仍覺得有些力不從心。',
    advice: '突破瓶頸的關鍵期！本課程將帶您掌握進階提示詞工程（思維鏈、自訂指令），並引導您學會如何利用多模態功能與知識管理工具，將 AI 真正內化為你的第二大腦。',
  },
  {
    id: 'advanced', min: 112, max: 148,
    badge: '🚀 AI 數位高潛力股', badgeEn: 'AI Advanced User', color: '#805ad5',
    desc: '您是團隊中的 AI 領先者！不僅對各大工具有高熟練度，還懂得利用 AI 解決複雜問題，甚至嘗試過建立專屬的 GPTs。您具備良好的資訊安全觀念，能引導 AI 產出高品質的專案物件。',
    advice: '邁向卓越的最後一哩路！課程將聚焦於「AI 工作流自動化串接」與「複雜場景下的企業級 Agent 應用開發」，協助您從個人高效升級為「團隊賦能者」。',
  },
  {
    id: 'catalyst', min: 149, max: 185,
    badge: '👑 AI 領航核心領袖', badgeEn: 'AI Catalyst', color: '#d69e2e',
    desc: '太優秀了！您具備極其全面的 AI 實戰能力與敏銳的創新思維。您不僅能開發出好用的客製化 AI 應用，更能兼顧倫理與資安管理，甚至已經在實質影響、帶動周遭的團隊進行數位轉型。',
    advice: '與大師同行！這門課程將成為您檢視自身技術盲點、優化架構的絕佳場域。期待您在課堂上與講師深入切磋，探討更前沿的 AI 落地策略與組織轉型佈局。',
  },
];

/**
 * 構面別的自動建議（規則庫）。依各構面的評級分成兩種情境：
 * - develop：弱項（待啟蒙/萌芽/發展中）→ 優先強化的具體行動。
 * - leverage：強項（熟練/精熟）→ 如何發揮並擴大影響。
 */
export const DIMENSION_ADVICE = {
  foundation: {
    develop: '先建立每日使用習慣：固定用一種主流模型（ChatGPT/Gemini/Claude）處理 Email、摘要與初稿，連續兩週養成「先問 AI」的反射動作。',
    leverage: '你已具備扎實的工具基礎，可進一步比較各模型在不同任務的優劣，成為團隊選工具時的諮詢窗口。',
  },
  communication: {
    develop: '套用提示詞公式「角色＋背景＋任務＋限制＋範例」，並練習用多輪對話逐步修正，而非期待一次到位。',
    leverage: '你的提問技巧成熟，建議整理一份個人提示詞模板庫，並嘗試 Few-Shot 與思維鏈等進階技巧拉高產出品質。',
  },
  workflow: {
    develop: '挑選一個重複性高的工作（如週報、資料彙整），試著用 AI 拆解步驟並固定成流程，先求穩定再求自動化。',
    leverage: '可導入 NotebookLM 建立知識庫，或用 Make／Zapier 串接 AI，把個人效率擴大為團隊可複用的自動化流程。',
  },
  collaboration: {
    develop: '練習當「總編輯」：不直接複製 AI 產出，而是設定明確修改方向；並嘗試上傳圖片／圖表讓 AI 做多模態分析。',
    leverage: '善用 Canva／Gamma 與多模態能力產出高質感成果，可主導跨格式、跨媒材的專案企劃。',
  },
  innovation: {
    develop: '從建立一個解決自身痛點的小型 GPTs 開始，設定知識庫並反覆測試回覆品質，累積客製化經驗。',
    leverage: '你已有開發能力，建議把做好的 GPTs／工具分享給團隊，並持續追蹤 AI Agent 等前沿趨勢。',
  },
  safety: {
    develop: '建立兩個底線習慣：關鍵數據一律人工核對（防幻覺）、機密與個資絕不輸入免費版 AI；並培養資訊真偽的篩選力。',
    leverage: '你的資安與素養觀念良好，可在團隊內推動使用規範、帶動同事提升 AI 素養。',
  },
};

export function dimensionRating(average) {
  if (average >= 4.2) return { label: '精熟', tone: 'strong' };
  if (average >= 3.4) return { label: '熟練', tone: 'good' };
  if (average >= 2.6) return { label: '發展中', tone: 'mid' };
  if (average >= 1.8) return { label: '萌芽', tone: 'low' };
  return { label: '待啟蒙', tone: 'weak' };
}

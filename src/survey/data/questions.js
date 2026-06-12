// AI 全方位職能實戰課前評測 — 題庫與構面定義
// 6 大構面、共 31 題，皆為 1~5 分李克特量表 (Likert scale)。
//   1 分 = 從未如此／極度不熟    5 分 = 總是如此／精通應用

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
    id: 'foundation',
    index: 1,
    name: '工具認知與基礎操作',
    subtitle: '基礎力',
    color: '#2b6cb0',
    questions: [
      { id: 'q1', text: '我能清晰分辨 ChatGPT、Gemini、Claude 等主流大語言模型各自的優勢。' },
      { id: 'q2', text: '我擁有付費訂閱（或高頻率使用）至少一種進階 AI 工具的經驗。' },
      { id: 'q3', text: '我經常使用 AI 進行日常的文字處理工作（如長文摘要、Email 撰寫）。' },
      { id: 'q4', text: '我嘗試過使用 AI 進行文字以外的生成任務（如 Midjourney、Gamma 簡報）。' },
      { id: 'q5', text: '當工作遇到新挑戰時，我第一個想到的解決方案是「先問問 AI 看看它能怎麼幫我」。' },
    ],
  },
  {
    id: 'communication',
    index: 2,
    name: '提示詞工程與對話技巧',
    subtitle: '溝通力',
    color: '#2f855a',
    questions: [
      { id: 'q6', text: '我瞭解在撰寫提示詞時，必須明確給予 AI「角色設定」與「背景資訊」。' },
      { id: 'q7', text: '我能熟練地在提示詞中加入「約束條件」（例如：限制字數、規定語氣）。' },
      { id: 'q8', text: '當 AI 第一次給出的答案不夠完美時，我懂得如何透過「多輪對話」逐步修正。' },
      { id: 'q9', text: '我知道如何建立與調整「自訂指令」，讓 AI 記住我的工作習慣。' },
      { id: 'q10', text: '我掌握進階提示詞技巧（例如：Few-Shot 範例引導、思維鏈引導）。' },
    ],
  },
  {
    id: 'workflow',
    index: 3,
    name: '工作流程整合與知識管理',
    subtitle: '應用力',
    color: '#dd6b20',
    questions: [
      { id: 'q11', text: '我已經將 AI 工具常駐在我的日常工作分頁中，每天使用時間超過 30 分鐘。' },
      { id: 'q12', text: '我知道如何利用 AI 協助我進行高效率的資料搜集、市場研究或競品分析。' },
      { id: 'q13', text: '我正在使用「NotebookLM」等工具，上傳文件建立個人的 AI 專屬知識庫。' },
      { id: 'q14', text: '我能運用 AI 協助工作流程的自動化（如使用 Make、Zapier 串接 AI）。' },
      { id: 'q15', text: '我能用 AI 來建立標準作業程序（SOP）或串聯多步驟的工作流。' },
    ],
  },
  {
    id: 'collaboration',
    index: 4,
    name: '生成物件精緻化與跨模態應用',
    subtitle: '協作力',
    color: '#805ad5',
    questions: [
      { id: 'q16', text: '我不會直接複製貼上 AI 的內容，而是扮演總編輯角色進行二次修改。' },
      { id: 'q17', text: '我能熟練使用 Canva Pro、Gamma 等工具快速產出具設計感的視覺物件。' },
      { id: 'q18', text: '我能熟練運用 AI 的「多模態功能」（例如：上傳圖片或數據圖表讓 AI 分析）。' },
      { id: 'q19', text: '我具備引導 AI 進行跨格式轉換的能力（如：文檔轉成 Markdown 或 Excel）。' },
      { id: 'q20', text: '我曾使用 AI 協助進行影音企劃（如腳本編寫、分鏡規劃或影音生成）。' },
    ],
  },
  {
    id: 'innovation',
    index: 5,
    name: '專屬 AI 應用開發與客製化',
    subtitle: '創新力',
    color: '#d53f8c',
    questions: [
      { id: 'q21', text: '我擁有建立自己專屬「GPTs」或客製化 AI 機器人的經驗。' },
      { id: 'q22', text: '我能正確設定 GPTs 的「Knowledge（知識庫）」並上傳有效文件。' },
      { id: 'q23', text: '我懂得如何測試與優化自己開發的 AI 機器人，使其回覆品質穩定。' },
      { id: 'q24', text: '我曾將自己做好的 GPTs 或 AI 工具分享給同事或團隊使用。' },
      { id: 'q25', text: '我有持續關注 AI 領域的最新發展（如新模型發表、AI Agent 技術趨勢）。' },
    ],
  },
  {
    id: 'safety',
    index: 6,
    name: 'AI 資訊素養與風險管理',
    subtitle: '安全思維力',
    color: '#319795',
    questions: [
      { id: 'q26', text: '我對 AI 的「幻覺」保持高度警覺，關鍵數據都一定會人工核對。' },
      { id: 'q27', text: '我從不將未公開的公司內部財務數據或客戶個資輸入到免費版 AI 中。' },
      { id: 'q28', text: '我瞭解生成式 AI 的版權爭議，並知道如何在安全邊界內商業應用。' },
      { id: 'q29', text: '面對鋪天蓋地的 AI 資訊，我能有效篩選辨識真偽，有系統地吸收。' },
      { id: 'q30', text: '我不會因為過度依賴 AI 而喪失自己獨立思考與批判性思維的能力。' },
      { id: 'q31', text: '我樂於與他人分享 AI 的使用心得，並推動周遭團隊提升 AI 素養。' },
    ],
  },
];

// 攤平後的題目清單，方便驗證與計分。
export const ALL_QUESTIONS = DIMENSIONS.flatMap((d) => d.questions);
export const TOTAL_QUESTIONS = ALL_QUESTIONS.length; // 31
export const MAX_TOTAL_SCORE = TOTAL_QUESTIONS * SCALE_MAX; // 155
export const MIN_TOTAL_SCORE = TOTAL_QUESTIONS * SCALE_MIN; // 31

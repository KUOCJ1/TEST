export const ID = 'ai-competency';
export const NAME = 'AI 全方位職能實戰課前評測';
export const DESCRIPTION = '6 大構面、48 題李克特量表（含反向題）';

export const SCALE_MIN = 1;
export const SCALE_MAX = 5;

export const SCALE_LABELS = [
  { value: 1, label: '非常不同意' },
  { value: 2, label: '不太同意' },
  { value: 3, label: '普通' },
  { value: 4, label: '大致同意' },
  { value: 5, label: '非常同意' },
];

// 題庫版本：2026-10 改版（37 → 48 題）。保留 6 構面與 id；以能力與做法描述取代產品名稱，
// 補上代理（Agent）、連接公司資料、品質驗證、治理與風險等 2026 年的核心能力，並拆掉雙重題項。
// 舊版（37 題）的作答結果是快照，不受影響；新結果會帶 itemVersion，方便日後分開分析。
export const ITEM_VERSION = '2026-10';

// 48 題超過預設的分頁門檻（40），但本評測維持單頁連續作答（與 v1 相同的已驗證流程，進度條會顯示完成度）。
export const PAGINATE = false;

export const DIMENSIONS = [
  {
    id: 'foundation', index: 1, name: '工具認知與基礎操作', subtitle: '基礎力', color: '#2b6cb0',
    questions: [
      { id: 'q1', text: '我能依任務特性選擇合適的 AI 工具或模型（例如日常對話、需要推理的分析、即時搜尋、圖像或程式），而不是每件事都用同一個。', reversed: false },
      { id: 'q2', text: '我使用過 AI 的進階功能（例如推理模式、深度研究、檔案或圖片分析），不只是一般的對話。', reversed: false },
      { id: 'q3', text: '我曾用 AI 完成需要多個步驟的工作（例如整理資料、分析、再產出報告或簡報），而不只是單次問答。', reversed: false },
      { id: 'q4', text: '我嘗試過用 AI 處理文字以外的內容（例如圖像、簡報、語音、影片或表格）。', reversed: false },
      { id: 'q5', text: '當工作遇到新挑戰時，我第一個想到的解決方案是「先問問 AI 看看它能怎麼幫我」。', reversed: false },
      { id: 'q38', text: '我能說出自己最常用的 2–3 種 AI 工作用法，以及它們各自幫我節省了多少時間或提升了哪方面的品質。', reversed: false },
      { id: 'q32', text: '就算公司導入了新的 AI 工具，我通常也提不起興趣去嘗試。', reversed: true },
    ],
  },
  {
    id: 'communication', index: 2, name: '提示詞工程與脈絡設計', subtitle: '溝通力', color: '#2f855a',
    questions: [
      { id: 'q6', text: '我會在提示詞中明確給予 AI「角色設定」與「背景資訊」。', reversed: false },
      { id: 'q7', text: '我能熟練地在提示詞中加入「約束條件」（例如限制字數、規定語氣、指定格式）。', reversed: false },
      { id: 'q40', text: '我會事先說清楚「完成的標準」與「不要做什麼」，而不只是交代要做什麼。', reversed: false },
      { id: 'q8', text: '當 AI 第一次給出的答案不夠完美時，我懂得如何透過「多輪對話」逐步修正。', reversed: false },
      { id: 'q9', text: '我會建立與調整「自訂指令、記憶或專案設定」，讓 AI 記住我的工作習慣與背景。', reversed: false },
      { id: 'q10', text: '我會在提示詞中提供範例或樣板（例如 Few-Shot），讓 AI 掌握我想要的格式與風格。', reversed: false },
      { id: 'q41', text: '我會依任務難度決定是否使用推理模式，並知道它通常比較慢、比較貴，不是每個問題都需要。', reversed: false },
      { id: 'q33', text: '我寫提示詞時常常一句話帶過，很少補充角色設定或背景資訊。', reversed: true },
    ],
  },
  {
    id: 'workflow', index: 3, name: '工作流程整合與 AI 代理', subtitle: '應用力', color: '#dd6b20',
    questions: [
      { id: 'q11', text: '我已經把 AI 固定放進我每週重複的工作流程中，而不是想到才用。', reversed: false },
      { id: 'q12', text: '我能用 AI 協助資料搜集、市場研究或競品分析，並會要求它附上來源、再自行查證。', reversed: false },
      { id: 'q13', text: '我會把自己的文件或資料整理成 AI 可以查詢的知識庫（例如筆記工具、專案或檔案庫），讓 AI 依我的資料回答。', reversed: false },
      { id: 'q14', text: '我能用自動化工具或連接器把 AI 串進工作流程（例如自動整理收到的信件、表單或會議紀錄）。', reversed: false },
      { id: 'q15', text: '我能用 AI 建立標準作業程序（SOP），或把多步驟的工作固定成可以重複使用的流程。', reversed: false },
      { id: 'q43', text: '我曾把一項多步驟的工作交給 AI 代理（Agent）自主執行，並事先設定它能做與不能做的範圍。', reversed: false },
      { id: 'q44', text: 'AI 代理要執行重要操作（例如寄信、修改資料、付款）前，我會要求先經過我確認，並檢查它的執行紀錄。', reversed: false },
      { id: 'q45', text: '我能把 AI 連接到公司的資料或工具（例如文件庫、行事曆、資料庫），讓它依最新的資料工作。', reversed: false },
      { id: 'q34', text: '除了偶爾問問題，AI 幾乎沒有真正進入我的日常工作流程。', reversed: true },
    ],
  },
  {
    id: 'collaboration', index: 4, name: '生成物件精緻化與跨模態應用', subtitle: '協作力', color: '#805ad5',
    questions: [
      { id: 'q16', text: '我不會直接複製貼上 AI 的內容，而是扮演總編輯，查證、修改，並調整成符合我的對象與用途。', reversed: false },
      { id: 'q17', text: '我能用 AI 工具快速產出具設計感的視覺物件（例如簡報、圖表、海報）。', reversed: false },
      { id: 'q18', text: '我能熟練運用 AI 的多模態功能（例如上傳圖片、數據圖表、截圖或語音，讓 AI 分析或回應）。', reversed: false },
      { id: 'q19', text: '我具備引導 AI 進行跨格式轉換的能力（如：文檔轉成 Markdown 或 Excel）。', reversed: false },
      { id: 'q46', text: '我會用 AI 協助分析資料（例如表格、公式、圖表），並自己驗算關鍵結果。', reversed: false },
      { id: 'q47', text: '我曾用 AI 協助撰寫小型腳本、公式或自動化工具，並在理解它做什麼之後才使用。', reversed: false },
      { id: 'q35', text: '我經常把 AI 生成的內容直接複製貼上交差，不太做二次修改。', reversed: true },
    ],
  },
  {
    id: 'innovation', index: 5, name: '專屬 AI 應用開發與品質驗證', subtitle: '創新力', color: '#d53f8c',
    questions: [
      { id: 'q21', text: '我有打造專屬 AI 助理（例如自訂 GPT、專案、Gem 或內部機器人）的經驗。', reversed: false },
      { id: 'q22', text: '我能為自己的 AI 助理設定「知識庫」並上傳有效文件，使其依我的資料回答。', reversed: false },
      { id: 'q23', text: '我會用一組固定的測試案例，檢查並比較自己做的 AI 助理或提示詞的結果是否穩定。', reversed: false },
      { id: 'q24', text: '我曾將自己做好的 AI 助理、提示詞範本或流程分享給同事或團隊使用。', reversed: false },
      { id: 'q25', text: '過去三個月，我試用過至少一項新的 AI 功能或工具，並評估過它是否適合我的工作。', reversed: false },
      { id: 'q48', text: '我曾重新設計一段工作流程（而不只是在原本流程上加一個 AI 步驟），並讓團隊採用。', reversed: false },
      { id: 'q49', text: '在推動一項 AI 應用之前，我會同時評估它的成本、風險與效益。', reversed: false },
      { id: 'q31', text: '我樂於與他人分享 AI 的使用心得，並推動周遭團隊提升 AI 素養。', reversed: false },
      { id: 'q36', text: '我覺得打造客製化 AI 應用太複雜，從沒想過要自己動手。', reversed: true },
    ],
  },
  {
    id: 'safety', index: 6, name: 'AI 資訊素養、風險與治理', subtitle: '安全思維力', color: '#319795',
    questions: [
      { id: 'q26', text: '我對 AI 的「幻覺」保持高度警覺，關鍵數據與事實一定會人工核對，並會要求 AI 提供依據。', reversed: false },
      { id: 'q27', text: '我清楚公司對使用 AI 的規範，並依資料的機密等級，決定能不能輸入、該用哪一種工具。', reversed: false },
      { id: 'q28', text: '我瞭解生成式 AI 的版權與授權爭議，也知道何時需要標示或揭露內容是 AI 協助產出。', reversed: false },
      { id: 'q29', text: '我能辨識 AI 生成或偽造的內容（例如假圖片、假聲音、假訊息），並有查證的習慣。', reversed: false },
      { id: 'q30', text: '我不會因為過度依賴 AI 而喪失自己獨立思考與批判性思維的能力。', reversed: false },
      { id: 'q50', text: '我知道 AI 代理或外部內容（例如網頁、文件）可能夾帶惡意指令誘導 AI（提示詞注入），不會輕易讓它處理來源不明的內容。', reversed: false },
      { id: 'q51', text: '對人或對外的決策使用 AI 之前，我會檢查它的輸出是否帶有偏見或不公平。', reversed: false },
      { id: 'q37', text: '趕時間時，我會直接採用 AI 給的數據，先用了再說。', reversed: true },
    ],
  },
];

export const ALL_QUESTIONS = DIMENSIONS.flatMap((d) => d.questions);
export const TOTAL_QUESTIONS = ALL_QUESTIONS.length;
export const MIN_SCORE = TOTAL_QUESTIONS * SCALE_MIN;
export const MAX_SCORE = TOTAL_QUESTIONS * SCALE_MAX;

// 落點門檻依 48 題（總分 48–240）等比例切分為四級（≈40% / 60% / 80%）。
// ⚠️ 2026-10 改版後題目變難（加入代理、品質驗證、治理），這組切分點是暫定值，收集到足夠資料後要用實際分布重新校準。
export const LEVELS = [
  {
    id: 'novice', min: 48, max: 96,
    badge: '🌱 AI 新手村', badgeEn: 'AI Novice', color: '#38a169',
    desc: '您對 AI 工具已有初步聽聞，但日常工作中較少主動使用。目前停留在「把 AI 當作更進階的 Google 搜尋」階段，有時會覺得 AI 回答不切實際或不知道該如何跟它對話。',
    advice: '萬丈高樓平地起！建議從大語言模型的操作介面與基礎提示詞架構（如設定角色、背景）開始學起，先培養每天讓 AI 幫忙寫 Email 或摘要長文的小習慣。',
  },
  {
    id: 'practitioner', min: 97, max: 144,
    badge: '📈 AI 應用實踐者', badgeEn: 'AI Practitioner', color: '#3182ce',
    desc: '您已經將 AI 融入部分日常工作，並掌握了基本的提示詞技巧，能透過對話讓 AI 產出可用的文字或圖片。但在處理複雜任務、讓 AI 連接您的資料與工具、或把工作固定成可重複的流程上，仍有不少進步空間。',
    advice: '突破瓶頸的關鍵期！本課程將帶您掌握脈絡設計（說清楚目標、完成標準與限制）、自訂指令與知識管理，並學會使用多模態功能，將 AI 真正內化為你的第二大腦。',
  },
  {
    id: 'advanced', min: 145, max: 192,
    badge: '🚀 AI 數位高潛力股', badgeEn: 'AI Advanced User', color: '#805ad5',
    desc: '您是團隊中的 AI 領先者！不僅對各大工具有高熟練度，還懂得利用 AI 解決複雜問題，甚至嘗試過建立專屬的 AI 助理或讓 AI 執行多步驟的工作。您具備良好的資訊安全觀念，能引導 AI 產出高品質的專案物件。',
    advice: '邁向卓越的最後一哩路！課程將聚焦於「讓 AI 代理安全地執行多步驟工作」、「連接公司的資料與工具」與「用測試案例驗證品質」，協助您從個人高效升級為「團隊賦能者」。',
  },
  {
    id: 'catalyst', min: 193, max: 240,
    badge: '👑 AI 領航核心領袖', badgeEn: 'AI Catalyst', color: '#d69e2e',
    desc: '太優秀了！您具備極其全面的 AI 實戰能力與敏銳的創新思維。您不僅能開發出好用的客製化 AI 應用、驗證它的品質，更能兼顧倫理與風險治理，甚至已經在重新設計流程、帶動周遭的團隊進行數位轉型。',
    advice: '與大師同行！這門課程將成為您檢視自身技術盲點、優化架構的絕佳場域。期待您在課堂上與講師深入切磋，探討更前沿的 AI 落地策略、風險治理與組織轉型佈局。',
  },
];

/**
 * 構面別的自動建議（規則庫）。依各構面的評級分成兩種情境：
 * - develop：弱項（待啟蒙/萌芽/發展中）→ 優先強化的具體行動。
 * - leverage：強項（熟練/精熟）→ 如何發揮並擴大影響。
 */
export const DIMENSION_ADVICE = {
  foundation: {
    develop: '先建立每日使用習慣：固定用一種主流 AI 助理處理 Email、摘要與初稿，連續兩週養成「先問 AI」的反射動作，再逐步嘗試不同模型的差異。',
    leverage: '你已具備扎實的工具基礎，可進一步依任務（長文分析、程式、搜尋、多模態）比較不同模型的優劣，成為團隊選工具時的諮詢窗口。',
  },
  communication: {
    develop: '套用提示詞公式「角色＋背景＋任務＋限制＋範例」，並練習用多輪對話逐步修正；開始前先把所需資料與判準整理給 AI，而非期待一次到位。',
    leverage: '你的提問與脈絡設計已成熟，建議整理個人提示詞與背景資料模板庫，並用範例、分步推理與自我檢查拉高產出的穩定度。',
  },
  workflow: {
    develop: '挑選一個重複性高的工作（如週報、資料彙整），試著用 AI 拆解步驟並固定成流程，先求穩定再求自動化。',
    leverage: '可嘗試把多步驟任務交給 AI 代理或自動化流程執行，並設計人工確認點與失敗處理，把個人效率擴大為團隊可複用的流程。',
  },
  collaboration: {
    develop: '練習當「總編輯」：不直接複製 AI 產出，而是設定明確修改方向；並嘗試上傳圖片／圖表讓 AI 做多模態分析。',
    leverage: '善用多模態能力與協作工具產出高質感成果，可主導跨格式、跨媒材的專案企劃，並與同事分享你的協作方法。',
  },
  innovation: {
    develop: '從建立一個解決自身痛點的小型 AI 應用開始（自訂助理、知識庫問答等），準備幾組固定測試題反覆驗證回覆品質。',
    leverage: '你已有開發能力，建議建立品質驗證與版本管理的習慣，把做好的工具分享給團隊，並持續追蹤代理與工具串接等前沿發展。',
  },
  safety: {
    develop: '建立兩個底線習慣：關鍵數據一律人工核對（防幻覺）、機密與個資不輸入未經公司許可的 AI 服務；並培養資訊真偽的篩選力。',
    leverage: '你的風險與治理觀念良好，可在團隊內推動使用規範與權限、紀錄的做法，帶動同事提升 AI 素養。',
  },
};

export function dimensionRating(average) {
  if (average >= 4.2) return { label: '精熟', tone: 'strong' };
  if (average >= 3.4) return { label: '熟練', tone: 'good' };
  if (average >= 2.6) return { label: '發展中', tone: 'mid' };
  if (average >= 1.8) return { label: '萌芽', tone: 'low' };
  return { label: '待啟蒙', tone: 'weak' };
}

// 課後學習成效問卷（韋能《AI 深度整合工作坊》）。設計稿：docs/post-course-survey-design.md。
//
// 這份問卷不走共用的李克特計分：結果由伺服器依清洗後的答案計算（server/src/lib/courseSurvey.js），
// 前端只負責收集答案與顯示。構面沿用課前評測 ai-competency 的 id 與順序，才能在同一張圖比較。
// 欄位白名單、情境題標準答案、構面對應都在伺服器那份；兩邊必須一致，有測試檢查
// （src/test/course-survey-parity.test.js）。標準答案刻意不放在前端，解析由伺服器結果決定顯示哪一個。
import { DIMENSIONS as AI_DIMENSIONS } from './ai-competency.js';

export const ID = 'ai-course-post';
export const NAME = 'AI 深度整合工作坊｜課後學習成效問卷';
export const NAME_EN = 'Post-Workshop Learning Survey';
export const ABBR = 'PWS';
export const DESCRIPTION = '課程滿意度、課前與現在的能力自評、情境檢核與 30 天承諾，約 12–15 分鐘。不是考試。';
export const ITEM_VERSION = '2026-10-30';

// 只對被「附加了這份問卷」的班級成員可見，不出現在評測工具庫、也不能當班級的主要評量。
export const CLASS_ONLY = true;
export const FORM = 'course-post';
export const REPORT = 'course-post';
export const SUPPORTS_360 = false;
export const PAGINATE = false;
export const SCALE_MIN = 1;
export const SCALE_MAX = 5;

/** B 部分的 12 項能力，依構面分組（id 與課前評測一致）。 */
const B_ITEMS = {
  foundation: [
    { n: 1, text: '判斷哪些工作適合做成 Agent（每週發生、每次都煩、可驗收）。' },
    { n: 2, text: '辨認 AI「很有自信但是錯」的情況（編造資料、「我們一定會……」）。' },
  ],
  communication: [
    { n: 3, text: '用角色設定與格式約束寫出可用的提示詞，並反覆修正。' },
    { n: 4, text: '提供範例（Few-Shot），讓 AI 照標準格式產出。' },
  ],
  workflow: [
    { n: 5, text: '用 OAR 把模糊的需求拆成讀者、步驟、相依與風險。' },
    { n: 6, text: '把一件重複的工作寫成使用者故事，並寫出可驗收的完成定義。' },
  ],
  collaboration: [
    { n: 9, text: '用反思提示讓 AI 對自己的產出做壓力測試，再由我判斷採用與否。' },
    { n: 10, text: '把成果分享給同事，並從他卡住的地方改進。' },
  ],
  innovation: [
    { n: 7, text: '用指令與知識來源建立一個小型 Agent。' },
    { n: 8, text: '用「正常、邊界、查無」三種題驗證 Agent，並依結果修正。' },
  ],
  safety: [
    { n: 11, text: '讓 Copilot 只根據指定文件回答，並回原文核對出處。' },
    { n: 12, text: '判斷哪些資料能使用（去識別化、只用公司授權工具）。' },
  ],
};

export const DIMENSIONS = AI_DIMENSIONS.map((d) => ({
  id: d.id,
  index: d.index,
  name: d.name,
  subtitle: d.subtitle,
  color: d.color,
  subDimensions: [],
  questions: B_ITEMS[d.id].map((i) => ({ id: `b${i.n}`, text: i.text, reversed: false })),
}));
export const ALL_QUESTIONS = DIMENSIONS.flatMap((d) => d.questions);

// ── 版面（問卷各部分）──────────────────────────────────────────
export const LIKERT_LABELS = ['非常不同意', '不同意', '普通', '同意', '非常同意'];
export const SKILL_LABELS = ['完全不會', '聽過但不會做', '有範例或協助才能做', '能獨立做到', '能教別人'];

export const SECTION_A = {
  items: [
    { id: 'a1', text: '課程內容與我的工作高度相關。' },
    { id: 'a2', text: '課程的深度與速度適合我目前的程度。' },
    { id: 'a3', text: '講師講解清楚，示範容易跟上。' },
    { id: 'a4', text: '實作練習與迷你黑客松，讓我把概念真正用出來。' },
    { id: 'a5', text: '我有足夠機會提問、討論和得到協助。' },
    { id: 'a6', text: '課程的時間安排與節奏恰當。' },
    { id: 'a7', text: 'Copilot 的帳號、權限與功能在課堂上順暢可用。' },
    { id: 'a8', text: '整體而言，我對這堂工作坊感到滿意。' },
  ],
  recommend: { id: 'a9', text: '您有多大可能向同事推薦這堂工作坊？（0＝完全不可能，10＝非常可能）' },
  modulesTitle: '各單元對我的幫助（1 幾乎沒幫助 … 5 非常有幫助）',
  modules: [
    { id: 'a10_1', text: 'M1　OAR 拆解' },
    { id: 'a10_2', text: 'M2　進階提示詞四技法' },
    { id: 'a10_3', text: 'M3　資料落地與建立 Agent' },
    { id: 'a10_4', text: 'NotebookLM 速覽' },
    { id: 'a10_5', text: '迷你黑客松與成果發表' },
    { id: 'a10_6', text: 'M4　落地策略與主管職責' },
  ],
};

/** 情境檢核：選項順序已打散；標準答案與計分在伺服器端，這裡只有題目與各選項的解析。 */
export const SECTION_C = [
  {
    id: 'c1', text: '您收到一封模糊的需求信：「請盡快整理一下上次的事。」第一步最適合？',
    options: [
      { id: 'a', text: '直接請 AI 整理' },
      { id: 'b', text: '先拆出讀者、步驟、相依與風險，再決定哪些交給 AI' },
      { id: 'c', text: '請 AI 猜測您想要什麼' },
    ],
    explain: 'OAR：模糊的需求先拆解，再交給 AI。直接丟給 AI 或要它猜，得到的是「看起來很完整、其實不是你要的」。',
  },
  {
    id: 'c2', text: '需要 AI 每天產出格式固定的工程日報，最有效的做法是？',
    options: [
      { id: 'a', text: '把格式要求寫得越長越好' },
      { id: 'b', text: '讓它自由發揮，再自己手動排版' },
      { id: 'c', text: '提供一兩份符合標準格式的範例讓它照做' },
    ],
    explain: 'Few-Shot：給範例比描述格式更穩定，AI 會照範例的結構與口吻產出。',
  },
  {
    id: 'c3', text: '您請 Copilot「只根據指定文件回答」，它給了答案。下一步？',
    options: [
      { id: 'a', text: '回到原文核對出處，找不到出處就不採用' },
      { id: 'b', text: '它有附說明，直接採用' },
      { id: 'c', text: '換個說法再問一次，答案一樣就採用' },
    ],
    explain: 'AI 可能很有自信但是錯。限定文件不等於不會錯，回原文核對出處是最後一道把關。',
  },
  {
    id: 'c4', text: '您做好一個 Agent，哪一組測試最能驗證它？',
    options: [
      { id: 'a', text: '同一題問三次' },
      { id: 'b', text: '正常題、邊界題、查無資料題各一' },
      { id: 'c', text: '只用範例裡的題目' },
    ],
    explain: '三種題各測一次：正常題確認會做，邊界題確認不亂做，查無題確認不知道時會說不知道。',
  },
  {
    id: 'c5', text: '下列哪件事最適合做成 Agent？',
    options: [
      { id: 'a', text: '每季一次的策略簡報' },
      { id: 'b', text: '一次性的臨時簡報' },
      { id: 'c', text: '每月 5 號前都要花一整天整理的月報異常摘要' },
    ],
    explain: '適合做成 Agent 的事：每週（月）固定發生、每次都很煩、做完可以驗收。一次性或很少發生的事不值得。',
  },
  {
    id: 'c6', text: '您想帶動團隊使用 AI，哪個做法最有效？',
    options: [
      { id: 'a', text: '自己先在團隊面前示範一次，並為每個嘗試訂完成定義與回顧時間' },
      { id: 'b', text: '在群組要求大家多用 AI' },
      { id: 'c', text: '等工具更成熟再說' },
    ],
    explain: '主管的三個職責：親自示範、給空間也給終點、守住資安邊界。示範比要求有效。',
  },
];

export const SECTION_D = {
  items: [
    { id: 'd1', text: '我會在下週五以前完成第一個一週衝刺。' },
    { id: 'd2', text: '我已經寫出可驗收的使用者故事與完成定義。' },
    { id: 'd3', text: '我有信心能獨立把它做出來。' },
    { id: 'd4', text: '我會在團隊面前示範一次怎麼用 AI。' },
  ],
  barriers: [
    { id: 'time', text: '沒時間' },
    { id: 'license', text: 'Copilot 授權或功能看不到' },
    { id: 'policy', text: '公司資安規範不明確' },
    { id: 'data', text: '沒有可去識別化的資料' },
    { id: 'unsure', text: '不確定做得對不對' },
    { id: 'support', text: '團隊或主管不支持' },
    { id: 'other', text: '其他' },
  ],
  commitment: { id: 'd6', text: '我承諾的第一個一週衝刺是：', placeholder: '例如：下週五前，用 Agent 跑出 9 月月報異常摘要，與我人工判斷一致，花費少於 1 小時。' },
  followUp: {
    id: 'd7',
    text: '我同意系統在 30 天與 60 天後，寄追蹤問卷到我註冊時使用的 Email。',
    note: '不勾選就不會寄；之後隨時可以在結果頁撤回。追蹤問卷只用來了解課程之後的應用情形。',
  },
};

export const SECTION_E = [
  { id: 'e1', text: '這堂工作坊對我最有價值的一個收穫是什麼？' },
  { id: 'e2', text: '最希望調整或加強的一件事是什麼？' },
  { id: 'e3', text: '我在工作上最想用 AI 解決的痛點是什麼？' },
];

/** 供卡片、作答時間估算等共用程式使用：實際作答欄位數（B 每項算兩次評分）。 */
export const TOTAL_QUESTIONS = 8 + 1 + SECTION_A.modules.length + ALL_QUESTIONS.length * 2 + SECTION_C.length + SECTION_D.items.length + 1;
export const MIN_SCORE = 0;
export const MAX_SCORE = SECTION_C.length;

export const LEVEL = {
  id: 'course-post', badge: '課後問卷已完成', badgeEn: 'Survey completed', color: '#2c5282',
  desc: '感謝填答。你的「課前 vs 現在」自評與情境檢核結果在下方；這不是考試，用來看見這一天的學習。',
  advice: '把你承諾的第一個一週衝刺訂成目標，下週五之前看見結果。',
};
export const LEVELS = [{ ...LEVEL, min: 0, max: MAX_SCORE }];

export const dimensionRating = (average) => {
  if (average >= 4.2) return { label: '精熟', tone: 'strong' };
  if (average >= 3.4) return { label: '熟練', tone: 'good' };
  if (average >= 2.6) return { label: '發展中', tone: 'mid' };
  if (average >= 1.8) return { label: '萌芽', tone: 'low' };
  return { label: '待啟蒙', tone: 'weak' };
};

/**
 * 首頁「評測工具庫」的展示資料。
 *
 * 為什麼不直接 import 題庫設定去算：整包題庫（含全部題目文字）約 35KB，而首頁是
 * 每個訪客的第一屏，不值得為了幾個數字把它拉進關鍵路徑。
 *
 * 但手抄數字會跟真實設定走鐘——首頁原本就寫死了 L9D 的「9 構面 / 20 子能力 /
 * 90 題」，導致 AI 職能評測（6 構面 / 37 題）的訪客看到的是錯的。因此
 * src/test/assessment-summary.test.js 會逐項比對這裡的數字與 getAssessment()
 * 的實際設定，對不上就讓測試失敗，不會再默默錯掉。
 *
 * 新增題庫時：在這裡補一筆，測試會提醒你有沒有漏。
 */
export const ASSESSMENT_SUMMARIES = [
  {
    id: 'ai-competency',
    name: 'AI 全方位職能實戰評測',
    tagline: '盤點個人 AI 應用能力的實戰水準',
    dimensions: 6,
    items: 37,
    subCompetencies: 0,
    features: ['6 大構面', '37 題李克特量表', '含反向計分題'],
  },
  {
    id: 'leadership-9d',
    name: '經贏® 領導力九大構面行為評量',
    tagline: '以行為錨點衡量領導力的成熟度',
    dimensions: 9,
    items: 90,
    subCompetencies: 20,
    features: ['9 大構面 × 20 項子能力', '90 題行為情境', '支援 360° 多元評測'],
  },
];

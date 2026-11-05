// 課後問卷（韋能《AI 深度整合工作坊》）30／60 天追蹤問卷的題目。
// 欄位白名單與驗證在伺服器（server/src/lib/courseFollowUp.js）；兩邊的題目 id 與選項必須一致，有測試檢查
// （src/test/course-follow-up.test.jsx）。設計稿：docs/post-course-survey-design.md 第 4 節。
import { SECTION_D } from './assessments/ai-course-post.js';

export const FOLLOW_UP_STAGES = [30, 60];

const HOURS = [
  { id: '0', text: '幾乎沒有省到' },
  { id: 'lt1', text: '不到 1 小時' },
  { id: '1to3', text: '1–3 小時' },
  { id: '3to5', text: '3–5 小時' },
  { id: 'gt5', text: '5 小時以上' },
];

export const FOLLOW_UP = {
  30: {
    title: '30 天追蹤',
    minutes: 5,
    intro: '回顧這 30 天，您把課堂上學到的東西用出來的情形。沒有對錯，照實回答就好。',
    questions: [
      { id: 'f1', type: 'single', required: true, text: '您承諾的第一個一週衝刺，目前進行得如何？', options: [{ id: 'done', text: '已完成' }, { id: 'half', text: '做了一半' }, { id: 'none', text: '還沒開始' }] },
      { id: 'f2', type: 'multi', text: '如果還沒完成，主要的阻礙是什麼？（可複選；已完成可略過）', options: SECTION_D.barriers.map((b) => ({ id: b.id, text: b.text })) },
      { id: 'f3', type: 'single', required: true, text: '您有建立自己的 Agent 嗎？', options: [{ id: 'reused', text: '有建立，而且重複使用中' }, { id: 'built', text: '有建立，但只用過一兩次' }, { id: 'not_yet', text: '還沒建立' }] },
      { id: 'f4', type: 'single', required: true, text: '您現在使用 Copilot 的頻率？', options: [{ id: 'daily', text: '幾乎每天' }, { id: 'weekly35', text: '每週 3–5 天' }, { id: 'weekly12', text: '每週 1–2 天' }, { id: 'rare', text: '偶爾' }, { id: 'never', text: '沒有在用' }] },
      { id: 'f5', type: 'single', required: true, text: '估計每週因為 AI 省下多少時間？', options: HOURS },
      { id: 'f6', type: 'single', required: true, text: '您是否已經在團隊面前示範過怎麼用 AI？', options: [{ id: 'yes', text: '是' }, { id: 'no', text: '還沒有' }] },
      { id: 'f7', type: 'text', text: '這 30 天最大的收穫，或最大的卡關是什麼？（選填）', max: 500 },
    ],
  },
  60: {
    title: '60 天追蹤',
    minutes: 5,
    intro: '回顧這兩個月 AI 在您工作上的持續使用與影響。沒有對錯，照實回答就好。',
    questions: [
      { id: 'g1', type: 'single', required: true, text: '您的團隊現在使用 AI 的情形？', options: [{ id: 'none', text: '幾乎沒有人在用' }, { id: 'few', text: '少數人在用' }, { id: 'some', text: '一部分人在用' }, { id: 'many', text: '大多數人都在用' }] },
      { id: 'g2', type: 'single', required: true, text: '估計每週因為 AI 省下多少時間？', options: HOURS },
      { id: 'g3', type: 'text', text: '目前持續使用 AI 的工作場景有哪些？（選填）', max: 500 },
      { id: 'g4', type: 'text', text: 'AI 對您的工作成果有什麼影響？（選填）', max: 500 },
      { id: 'g5', type: 'single', required: true, text: '您是否需要進階課程？', options: [{ id: 'yes', text: '需要' }, { id: 'maybe', text: '看內容再決定' }, { id: 'no', text: '暫時不需要' }] },
    ],
  },
};

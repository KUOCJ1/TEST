// 課後追蹤問卷的欄位白名單與答案清洗（純函式，不依賴寄信模組，前端測試也會匯入它檢查題目一致）。
import { BARRIER_CODES } from './courseSurvey.js';

export const FOLLOW_UP_STAGES = [30, 60];
const HOURS = ['0', 'lt1', '1to3', '3to5', 'gt5'];

/** 追蹤問卷的欄位白名單（前端的題目與選項在 src/survey/data/course-follow-up.js，兩邊由測試檢查一致）。 */
export const FOLLOW_UP_QUESTIONS = {
  30: [
    { id: 'f1', type: 'single', required: true, options: ['done', 'half', 'none'] },
    { id: 'f2', type: 'multi', options: BARRIER_CODES },
    { id: 'f3', type: 'single', required: true, options: ['reused', 'built', 'not_yet'] },
    { id: 'f4', type: 'single', required: true, options: ['daily', 'weekly35', 'weekly12', 'rare', 'never'] },
    { id: 'f5', type: 'single', required: true, options: HOURS },
    { id: 'f6', type: 'single', required: true, options: ['yes', 'no'] },
    { id: 'f7', type: 'text', max: 500 },
  ],
  60: [
    { id: 'g1', type: 'single', required: true, options: ['none', 'few', 'some', 'many'] },
    { id: 'g2', type: 'single', required: true, options: HOURS },
    { id: 'g3', type: 'text', max: 500 },
    { id: 'g4', type: 'text', max: 500 },
    { id: 'g5', type: 'single', required: true, options: ['yes', 'maybe', 'no'] },
  ],
};

/** 清洗追蹤問卷答案：只留白名單欄位；必填沒答或選項不認得就丟錯。 */
export function sanitizeFollowUpAnswers(stage, input) {
  const spec = FOLLOW_UP_QUESTIONS[stage];
  if (!spec) throw new Error('不認得的追蹤階段');
  if (!input || typeof input !== 'object') throw new Error('缺少答案');
  const out = {};
  for (const q of spec) {
    const v = input[q.id];
    const blank = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (blank) {
      if (q.required) throw new Error(`${q.id} 必填`);
      continue;
    }
    if (q.type === 'single') {
      if (!q.options.includes(v)) throw new Error(`${q.id} 有不認得的選項`);
      out[q.id] = v;
    } else if (q.type === 'multi') {
      if (!Array.isArray(v) || v.length > q.options.length) throw new Error(`${q.id} 格式不正確`);
      const picked = [...new Set(v)];
      if (picked.some((c) => !q.options.includes(c))) throw new Error(`${q.id} 有不認得的選項`);
      out[q.id] = picked;
    } else {
      if (typeof v !== 'string') throw new Error(`${q.id} 格式不正確`);
      out[q.id] = v.trim().slice(0, q.max);
    }
  }
  return out;
}

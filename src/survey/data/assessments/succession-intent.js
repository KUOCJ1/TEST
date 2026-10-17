import { NA_VALUE, completeness, unansweredQuestionIds, buildResult } from '../../utils/successionScoring.js';

// 接班準備度評測。規格：docs/leadership-new/06-succession-questionnaire-v0.1.md
// 只自評；不做總分與排名；「長期意向」面向的題目可選答。
export const ID = 'succession-intent';
export const SUPPORTS_360 = false;
export const NAME = '接班準備度評測';
export const NAME_EN = 'Succession Readiness Assessment';
export const ABBR = 'SRA';
export const DESCRIPTION = '整理您對升任、準備程度、可接受的條件與長期方向的想法，作為發展對話的素材。不是評分，沒有對錯。共 20 題，長期意向的題目可選擇不回答。';

export const SCALE_MIN = 1;
export const SCALE_MAX = 5;
export const NA_LABEL = '不想回答';
export { NA_VALUE };
export const PAGINATE = false;
export const REPORT = 'succession';
export const PROFILE_MODE = true;

const q = (id, text, subId, extra = {}) => ({ id: `si-${id}`, text, reversed: false, subId, ...extra });

export const DIMENSIONS = [
  {
    id: 'ambition', index: 1, name: '升任企圖', subtitle: 'Ambition', color: '#2b6cb0', subDimensions: [],
    questions: [
      q('amb-1', '我希望未來三到五年內，能承擔比現在更大的責任範圍。'),
      q('amb-2', '想到要帶領更多人、決定更重要的事，我感到期待多於負擔。'),
      q('amb-3', '我會主動讓主管知道我想往更高的職務發展。'),
      q('amb-4', '我願意為了更高的職務，投入額外的學習與準備。'),
      q('amb-5', '就算有機會，我也寧願維持現在的職務與責任範圍。', null, { reversed: true }),
    ],
  },
  {
    id: 'readiness', index: 2, name: '準備程度', subtitle: 'Readiness', color: '#2f855a', subDimensions: [],
    questions: [
      q('rdy-1', '如果明年被指派更大的職務，我有信心在半年內上手。'),
      q('rdy-2', '我清楚知道自己距離下一個職務還缺哪些能力。'),
      q('rdy-3', '我已經在做某些下一個職務才會做的事。'),
      q('rdy-4', '我身邊有可以請教、也願意幫我的人。'),
      q('rdy-5', '我覺得自己還沒準備好承擔更大的責任。', null, { reversed: true }),
    ],
  },
  {
    id: 'terms', index: 3, name: '條件接受', subtitle: 'Terms', color: '#975a16', subDimensions: [],
    questions: [
      q('trm-1', '為了擔任更高的職務，我可以接受工作量與責任明顯增加。'),
      q('trm-2', '為了擔任更高的職務，我可以接受經常出差或跨地點工作。'),
      q('trm-3', '我可以接受在新職務上，一開始要處理很多不熟悉的領域。'),
      q('trm-4', '我可以接受做出可能讓一部分人不滿意的決定。'),
      q('trm-5', '我目前能投入工作的時間與精力，已經沒有再增加的空間。', null, { reversed: true }),
    ],
  },
  {
    id: 'outlook', index: 4, name: '長期意向', subtitle: 'Outlook', color: '#6b46c1', subDimensions: [],
    questions: [
      q('out-1', '我希望未來幾年繼續在這個組織發展。', null, { optional: true }),
      q('out-2', '我認為在這裡，有機會走到我想去的位置。', null, { optional: true }),
      q('out-3', '我願意把培養接班人、傳承經驗，當成自己職責的一部分。', null, { optional: true }),
      q('out-4', '我對組織目前的方向有信心。', null, { optional: true }),
      q('out-5', '我最近常認真考慮換到別的組織。', null, { optional: true, reversed: true }),
    ],
  },
];

export const ALL_QUESTIONS = DIMENSIONS.flatMap((d) => d.questions);
export const TOTAL_QUESTIONS = ALL_QUESTIONS.length;
export const MIN_SCORE = TOTAL_QUESTIONS * SCALE_MIN;
export const MAX_SCORE = TOTAL_QUESTIONS * SCALE_MAX;

export const PROFILE_LEVEL = {
  id: 'succession-intent', badge: '您的接班想法', badgeEn: 'Succession Outlook', color: '#2c5282',
  desc: '這份整理描述您對升任、準備程度、可接受條件與長期方向的想法，用來支持發展對話，不是評分。',
  advice: '挑一個您最想聊的面向，和主管或教練約一次對話。',
};
export const LEVELS = [{ ...PROFILE_LEVEL, min: 0, max: Infinity }];
export const PROFILES = { default: PROFILE_LEVEL };

export const dimensionRating = (avg) => (avg >= 4 ? { label: '明確', tone: 'strong' } : avg >= 3 ? { label: '開放', tone: 'good' } : { label: '保留', tone: 'mid' });

/** 複製結果摘要：只列各面向的傾向，不含總分與排名。 */
export function summaryText(result) {
  return [
    `${result.assessmentName ?? NAME} — 結果摘要`,
    '',
    ...result.dimensions.map((d) => `・${d.name}：${d.answered > 0 ? `傾向${d.rating.label}` : '未回答'}`),
  ].join('\n');
}

export const SCORING = {
  answeredCount: (a, cfg) => { const c = completeness(a, cfg); return c.valid + c.na; },
  isComplete: (a, cfg) => completeness(a, cfg).complete,
  unansweredQuestionIds: (a, cfg) => unansweredQuestionIds(a, cfg),
  buildResult: (a, cfg) => buildResult(a, { ...cfg, ID, NAME, PROFILE_LEVEL }),
};

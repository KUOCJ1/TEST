import { COMPASS_ITEMS } from './compass-items.generated.js';
import {
  NA_VALUE, selectForm as selectCompassForm, buildCompassResult, completeness, questionState, dimensionRating as compassRating,
} from '../../utils/compassScoring.js';

// 雙環領導羅盤（Dual-Loop Leadership Compass）。規格：docs/leadership-new/04-platform-spec-v0.1.md
// 題目由 scripts/build-compass-config.mjs 從 docs/leadership-new/items-candidates-*.json 產生，
// 不要在這裡手寫題目。計分在 utils/compassScoring.js（純函式，不影響其他題庫）。
export const ID = 'leadership-compass';
export const ITEM_VERSION = 'compass-0.3';
export const SUPPORTS_360 = true;
export const NAME = '雙環領導羅盤八大構面評測';
export const NAME_EN = 'Dual-Loop Leadership Compass';
export const ABBR = 'DLLC';
export const DESCRIPTION = '以行為頻率衡量領導力：快環（洞察、聚焦、授權、凝聚）與永環（學習、穩定、育才、傳承）共 8 構面，含人機協作與四組張力指標。預設精簡版 32 題，亦可選完整版 69 題。';
export const RATER_PROMPT = '的領導行為表現';

export const SCALE_MIN = 1;
export const SCALE_MAX = 5;
export const SCALE_LABELS = [
  { value: 1, label: '從不' },
  { value: 2, label: '很少' },
  { value: 3, label: '有時' },
  { value: 4, label: '經常' },
  { value: 5, label: '總是' },
];
export const SCALE_HINT = '這是行為「頻率」，不是能力高低；沒有標準答案，請依實際狀況作答。';
export { NA_VALUE };
export const NA_LABEL = '無法判斷';

export const FORMS = [
  { id: 'short', name: '精簡版', description: '32 題，適合組織診斷與追蹤' },
  { id: 'full', name: '完整版', description: '69 題，適合主管發展與深入討論' },
];
export const DEFAULT_FORM = 'short';

// 分頁：完整版有 8 個構面，精簡版雖然只有 32 題，也維持 8 段，避免畫面一次太長。
export const PAGINATE = true;

// 結果頁使用專屬報告元件（components/compass/CompassResultPanel.jsx）。
export const REPORT = 'compass';

// 框架說明頁（公開）；作答前導讀、評量卡片與報告都連到這裡。內容在 compass-framework.js。
export const FRAMEWORK_PATH = '/framework';

// 360° 評分者隱私（伺服器端強制，見 server/src/lib/compassPrivacy.js）；前端據此不顯示「還原身分」類功能。
export const STRICT_RATER_PRIVACY = true;
export const RATER_TARGET = { min: 2, max: 3, threshold: 3 }; // 每類建議邀請 2–3 位；單獨顯示需 ≥3 位

// 評分者作答前的說明（依評分者類型）。
export const RATER_NOTICE = {
  default: '您的個別回答不會顯示給受評者或教練，結果只以多位評分者的平均呈現；同類評分者少於 3 位時不會單獨顯示。平台管理員在必要時（例如處理申訴）可查看評分者身分，並會留下紀錄。',
  manager: '您是受評者的上級：您的評分無法匿名，您的身分可被辨識。受評者同意後，您的評分才會出現在他的報告中。',
};

const DIM_META = [
  { id: 'find', index: 1, name: '洞察情勢', subtitle: 'Find', color: '#2b6cb0', loop: 'fast' },
  { id: 'aim', index: 2, name: '聚焦應變', subtitle: 'Aim', color: '#2c7a7b', loop: 'fast' },
  { id: 'staff', index: 3, name: '知人授權', subtitle: 'Staff', color: '#6b46c1', loop: 'fast' },
  { id: 'team', index: 4, name: '凝聚帶動', subtitle: 'Team', color: '#c05621', loop: 'fast' },
  { id: 'learn', index: 5, name: '敏捷學習', subtitle: 'Learn', color: '#2f855a', loop: 'last' },
  { id: 'anchor', index: 6, name: '穩定當責', subtitle: 'Anchor', color: '#975a16', loop: 'last' },
  { id: 'sow', index: 7, name: '識才育才', subtitle: 'Sow', color: '#9b2c2c', loop: 'last' },
  { id: 'transfer', index: 8, name: '傳承留能', subtitle: 'Transfer', color: '#4a5568', loop: 'last' },
];

const SUB_NAMES = {
  'risk-foresight': '風險預見', 'hear-truth': '傾聽真話', 'spot-constraints': '辨識限制', 'data-judgment': '數據判斷',
  'focus-tradeoff': '聚焦取捨', 'flex-adjust': '彈性調整',
  'know-people': '知人善任', 'delegate-own': '授權當責', 'human-ai': '人機配置',
  recognize: '激勵認可', integrate: '整合衝突', 'cross-level': '跨層關係',
  'learn-speed': '學習速度', 'tool-learning': '工具學習', retrospect: '復盤檢討',
  crisis: '危機穩定', accountability: '承擔責任', 'self-regulate': '情緒調節',
  'spot-potential': '發掘潛力', 'tiered-dev': '分層培育', 'growth-talk': '成長對話',
  capture: '經驗沉澱', continuity: '機制延續', 'share-out': '對外分享',
};

export const LOOPS = [
  { id: 'fast', name: '快環', nameEn: 'FAST', dimensionIds: ['find', 'aim', 'staff', 'team'] },
  { id: 'last', name: '永環', nameEn: 'LAST', dimensionIds: ['learn', 'anchor', 'sow', 'transfer'] },
];

export const TENSIONS = [
  { id: 'focus-flex', dimensionId: 'aim', poleA: 'focus', poleB: 'flex', nameA: '聚焦', nameB: '彈性' },
  { id: 'delegate-hold', dimensionId: 'staff', poleA: 'delegate', poleB: 'hold', nameA: '授權', nameB: '掌握' },
  { id: 'relation-result', dimensionId: 'team', poleA: 'relation', poleB: 'result', nameA: '關係', nameB: '成果' },
  { id: 'system-authority', dimensionId: 'transfer', poleA: 'system', poleB: 'authority', nameA: '機制', nameB: '個人權威' },
];

export const DIMENSIONS = DIM_META.map((meta) => {
  const questions = COMPASS_ITEMS.filter((i) => i.dim === meta.id).map((i) => ({
    id: i.id,
    text: i.text,
    textOther: i.textOther,
    reversed: i.reversed,
    subId: i.sub,
    forms: i.forms,
    observability: i.observability,
    ...(i.ai ? { ai: true } : {}),
    ...(i.pole ? { pole: i.pole } : {}),
  }));
  const subIds = [...new Set(questions.map((q) => q.subId))];
  return { ...meta, subDimensions: subIds.map((id) => ({ id, name: SUB_NAMES[id] })), questions };
});

export const ALL_QUESTIONS = DIMENSIONS.flatMap((d) => d.questions);
export const TOTAL_QUESTIONS = ALL_QUESTIONS.length; // 完整版題數；實際作答的題數依所選版本（見 selectForm）
export const MIN_SCORE = TOTAL_QUESTIONS * SCALE_MIN;
export const MAX_SCORE = TOTAL_QUESTIONS * SCALE_MAX;

export const dimensionRating = compassRating;

/** 複製結果摘要：此評量沒有總分與排名，只列各構面平均、兩環與張力取向。 */
export function summaryText(result) {
  return [
    `${result.assessmentName ?? NAME} — 結果摘要`,
    '',
    ...(result.loops ?? []).map((l) => `${l.name}平均：${l.average.toFixed(1)}`),
    '',
    '各構面平均（行為頻率 1–5）：',
    ...result.dimensions.map((d) => `・${d.name}：${d.answered > 0 ? d.average.toFixed(1) : '—'}`),
    '',
    '四組張力：',
    ...(result.tensions ?? []).map((t) => `・${t.nameA} ↔ ${t.nameB}：${t.available ? `${t.a.toFixed(1)} / ${t.b.toFixed(1)}` : '資料不足'}`),
  ].join('\n');
}

// 此評量不做總分分級（見規格第 1、4 節）：結果元件需要一個 level 物件，這裡給固定的中性說明。
export const PROFILE_MODE = true;
export const PROFILE_LEVEL = {
  id: 'compass-profile',
  badge: '您的雙環輪廓',
  badgeEn: 'Dual-Loop Profile',
  color: '#2c5282',
  desc: '這份報告呈現您在快環與永環八個構面的行為頻率，以及四組張力的取向。重點不是總分高低，而是哪些行為已成習慣、哪些在特定情境下會變成限制。',
  advice: '先看兩個環的整體平衡，再看最高與最低的構面；有他評資料時，留意自評與他評落差最大的地方，那裡通常最值得對話。',
};
// PROFILE_MODE 的元件會讀 LEVELS／PROFILES；提供一份單一項目的對照避免分支錯誤。
export const LEVELS = [{ ...PROFILE_LEVEL, min: 0, max: Infinity }];
export const PROFILES = { default: PROFILE_LEVEL };

/** 依版本取得作答用的設定視圖（見 utils/compassScoring.selectForm）。 */
export function selectForm(form = DEFAULT_FORM) {
  return selectCompassForm(
    { ID, NAME, SCALE_MIN, SCALE_MAX, DIMENSIONS, LOOPS, TENSIONS, ITEM_VERSION, PROFILE_LEVEL },
    form,
  );
}

/**
 * 各流程統一透過這組計分函式（SurveyApp 會優先使用 config.SCORING）。
 * config 參數是 selectForm() 回傳的視圖；rater: 'self' | 'other'。
 */
export const SCORING = {
  // 已回應題數：有效分＋合法的「無法判斷」。
  answeredCount: (answers, view, { rater = 'self' } = {}) => {
    const c = completeness(answers, view, rater);
    return c.valid + c.na;
  },
  isComplete: (answers, view, { rater = 'self' } = {}) => completeness(answers, view, rater).complete,
  // 尚未回應的題目（含自評時誤填「無法判斷」的題目）。
  unansweredQuestionIds: (answers, view, { rater = 'self' } = {}) => view.ALL_QUESTIONS
    .filter((q) => questionState(answers[q.id], q, view, rater) === 'missing')
    .map((q) => q.id),
  buildResult: (answers, view, { rater = 'self' } = {}) => buildCompassResult(
    answers,
    { ID, NAME, SCALE_MIN, SCALE_MAX, DIMENSIONS, LOOPS, TENSIONS, ITEM_VERSION, PROFILE_LEVEL },
    { form: view.FORM ?? 'full', rater, itemVersion: ITEM_VERSION },
  ),
};

import { buildResult } from '../utils/scoring.js';

// 批次上傳的驗證與計分（純函式，從 BatchUploadSection.jsx 抽出來好寫測試）。
//
// 新增的硬性檢查（Sprint 21-B，起因是 70 題的資料被傳進 90 題的評量，缺的題目被當成 0 分、結果全錯）：
// 1. 檔案必須有這份評量的每一個題目欄位；缺任何一個題目欄位 → 整個檔案不能匯入。
// 2. 不屬於這份評量、卻有資料的「題目欄位」（例如 l71–l90 之於 70 題的評量）→ 整個檔案不能匯入；
//    這些欄位全部是空的 → 只警告。
// 3. 每一列必須答滿這份評量的所有題目；缺題的列預設不匯入，要勾「允許缺題」才會匯入（缺題不計分）。

export const RATER_TYPES = new Set(['self', 'manager', 'peer', 'subordinate']);
const META = new Set(['ratee_email', 'ratee_name', 'rater_type', 'rater_email', 'rater_name', 'phase']);
// 階段（選填）：pre＝課前／前測、post＝課後／後測；也接受中文。留空＝不標記階段（分析時視為前測）。
const PHASE_ALIASES = { pre: 'pre', post: 'post', 課前: 'pre', 前測: 'pre', 課後: 'post', 後測: 'post' };
export function parsePhase(raw) {
  const key = String(raw ?? '').trim().toLowerCase();
  if (key === '') return { phase: null };
  const phase = PHASE_ALIASES[key];
  return phase ? { phase } : { error: key };
}
// 題目欄位的樣子：字母加數字（l12、q5…）。
const QUESTION_LIKE = /^[a-z]{1,3}\d{1,3}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isBlank = (v) => v === '' || v === null || v === undefined;

/** 比對檔案欄位與評量的題目。 */
export function columnReport(rawRows, config) {
  const header = rawRows.length ? Object.keys(rawRows[0]) : [];
  const expected = config.ALL_QUESTIONS.map((q) => q.id);
  const expectedSet = new Set(expected);
  const headerSet = new Set(header);
  const missing = expected.filter((id) => !headerSet.has(id));
  const extra = header.filter((h) => !META.has(h) && QUESTION_LIKE.test(h) && !expectedSet.has(h));
  const extraWithData = extra.filter((h) => rawRows.some((r) => !isBlank(r[h])));
  const extraEmpty = extra.filter((h) => !extraWithData.includes(h));
  return { missing, extraWithData, extraEmpty };
}

const list = (ids, n = 6) => ids.slice(0, n).join('、') + (ids.length > n ? `…等 ${ids.length} 個` : '');

/**
 * @returns {{results: Array, errors: Array<{row:number,message:string}>, fileIssues: Array<{level:'error'|'warn', message:string}>}}
 *   fileIssues 的 error 代表整個檔案不能匯入（results 會是空的）。
 */
export function validateAndScore(rawRows, config, { allowPartial = false } = {}) {
  const results = [];
  const errors = [];
  const fileIssues = [];

  if (rawRows.length > 0) {
    const { missing, extraWithData, extraEmpty } = columnReport(rawRows, config);
    if (missing.length > 0) {
      fileIssues.push({ level: 'error', message: `檔案缺少「${config.NAME}」的 ${missing.length} 個題目欄位（${list(missing)}）。這份評量共 ${config.TOTAL_QUESTIONS} 題，檔案與這份評量對不上，請確認評量選對了、或使用這份評量的範本。` });
    }
    if (extraWithData.length > 0) {
      fileIssues.push({ level: 'error', message: `檔案有 ${extraWithData.length} 個題目欄位（${list(extraWithData)}）有資料，但不屬於「${config.NAME}」（共 ${config.TOTAL_QUESTIONS} 題）。資料可能是別份評量的，請確認評量選對了。` });
    }
    if (extraEmpty.length > 0) {
      fileIssues.push({ level: 'warn', message: `檔案另有 ${extraEmpty.length} 個題目欄位（${list(extraEmpty)}）不屬於這份評量，內容是空的，已忽略。` });
    }
    if (fileIssues.some((i) => i.level === 'error')) return { results, errors, fileIssues };
  }

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNum = i + 2;

    const rateeEmail = String(row['ratee_email'] ?? '').trim().toLowerCase();
    const rateeName = String(row['ratee_name'] ?? '').trim();
    const raterType = String(row['rater_type'] ?? '').trim().toLowerCase();
    const raterEmail = String(row['rater_email'] ?? '').trim().toLowerCase();
    const raterName = String(row['rater_name'] ?? '').trim();

    if (!rateeEmail) { errors.push({ row: rowNum, message: '缺少 ratee_email' }); continue; }
    if (!EMAIL.test(rateeEmail)) { errors.push({ row: rowNum, message: `ratee_email 格式錯誤：${rateeEmail}` }); continue; }
    if (!RATER_TYPES.has(raterType)) { errors.push({ row: rowNum, message: `rater_type 必須為 self / manager / peer / subordinate，目前值：「${raterType}」` }); continue; }
    if (raterType !== 'self' && !raterEmail) { errors.push({ row: rowNum, message: `rater_type="${raterType}" 時，rater_email 不可為空` }); continue; }
    if (raterEmail && !EMAIL.test(raterEmail)) { errors.push({ row: rowNum, message: `rater_email 格式錯誤：${raterEmail}` }); continue; }
    const parsedPhase = parsePhase(row['phase']);
    if (parsedPhase.error !== undefined) { errors.push({ row: rowNum, message: `phase 必須為 pre / post（或 課前 / 課後），或留空；目前值：「${parsedPhase.error}」` }); continue; }

    const answers = {};
    let invalidCount = 0;
    for (const q of config.ALL_QUESTIONS) {
      const raw = row[q.id];
      if (isBlank(raw)) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < config.SCALE_MIN || n > config.SCALE_MAX) { invalidCount++; continue; }
      answers[q.id] = n;
    }

    const answered = Object.keys(answers).length;
    if (answered === 0) { errors.push({ row: rowNum, message: '未偵測到任何有效答題資料，請確認題目欄位名稱是否與範本一致' }); continue; }
    if (invalidCount > 0 && !allowPartial) { errors.push({ row: rowNum, message: `有 ${invalidCount} 題答案超出量表範圍（${config.SCALE_MIN}–${config.SCALE_MAX}），這一列不匯入` }); continue; }
    if (answered < config.TOTAL_QUESTIONS && !allowPartial) {
      errors.push({ row: rowNum, message: `只作答 ${answered} / ${config.TOTAL_QUESTIONS} 題，缺題的列不匯入（缺題會被當成沒作答，影響分數）。要匯入請勾選「允許缺題」` });
      continue;
    }
    if (invalidCount > 0) errors.push({ row: rowNum, message: `${invalidCount} 題答案超出量表範圍（${config.SCALE_MIN}–${config.SCALE_MAX}），已略過不計分` });

    const result = buildResult(answers, config);

    results.push({
      _rowNum: rowNum,
      rateeEmail,
      rateeName: rateeName || rateeEmail.split('@')[0],
      raterType,
      phase: parsedPhase.phase,
      raterEmail: raterType === 'self' ? rateeEmail : raterEmail,
      raterName: raterType === 'self' ? (rateeName || rateeEmail.split('@')[0]) : (raterName || raterEmail.split('@')[0]),
      answers,
      result,
      answeredCount: answered,
      totalQuestions: config.TOTAL_QUESTIONS,
    });
  }
  return { results, errors, fileIssues };
}

import { describe, it, expect } from 'vitest';
import { validateAndScore, columnReport } from '../survey/admin/batchValidation.js';
import { getAssessment } from '../survey/data/assessments/index.js';
import { buildPrePost } from '../survey/utils/prePost.js';

// 起因：森永 360 專案，70 題的資料被傳進 90 題的 L9D，缺的題目變成 0 分、結果全錯。
// 這些檢查要讓這種情況在匯入前就被擋下。

const c70 = getAssessment('leadership-360-70');
const l9d = getAssessment('leadership-9d');

const rowFor = (cfg, { answered = cfg.TOTAL_QUESTIONS, value = 4, columns = cfg.ALL_QUESTIONS.map((q) => q.id), extra = {} } = {}) => {
  const r = { ratee_email: 'a@p.invalid', ratee_name: '甲', rater_type: 'self', rater_email: '', rater_name: '' };
  columns.forEach((id, i) => { r[id] = i < answered ? String(value) : ''; });
  return { ...r, ...extra };
};

describe('欄位對照', () => {
  it('完全對得上：沒有缺少、沒有多餘', () => {
    expect(columnReport([rowFor(c70)], c70)).toEqual({ missing: [], extraWithData: [], extraEmpty: [] });
  });

  it('70 題的資料（只有 l1–l70 欄位）對 L9D：缺 20 個題目欄位', () => {
    const rep = columnReport([rowFor(c70)], l9d);
    expect(rep.missing).toHaveLength(20);
    expect(rep.missing[0]).toBe('l71');
  });
});

describe('這次事故：70 題資料傳進 90 題的 L9D', () => {
  it('90 欄範本、只填 70 題（l71–l90 空白）→ 每一列都被擋下，不匯入、不會變成 0 分', () => {
    const rows = [rowFor(l9d, { answered: 70 }), rowFor(l9d, { answered: 70, extra: { rater_type: 'manager', rater_email: 'm@p.invalid' } })];
    const { results, errors, fileIssues } = validateAndScore(rows, l9d);
    expect(fileIssues.filter((i) => i.level === 'error')).toEqual([]);
    expect(results).toHaveLength(0);
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toMatch(/只作答 70 \/ 90 題/);
  });

  it('只有 70 個欄位的檔案傳進 L9D → 整個檔案不能匯入，並說明缺哪些欄位', () => {
    const { results, fileIssues } = validateAndScore([rowFor(c70)], l9d);
    expect(results).toHaveLength(0);
    expect(fileIssues).toHaveLength(1);
    expect(fileIssues[0].level).toBe('error');
    expect(fileIssues[0].message).toMatch(/缺少.*20 個題目欄位/);
    expect(fileIssues[0].message).toMatch(/l71/);
  });
});

describe('另一個方向：90 欄範本用在 70 題的評量', () => {
  it('l71–l90 欄位存在但全部空白 → 只警告並忽略，其他資料正常匯入', () => {
    const cols = l9d.ALL_QUESTIONS.map((q) => q.id);
    const { results, fileIssues } = validateAndScore([rowFor(c70, { columns: cols, answered: 70 })], c70);
    expect(fileIssues).toHaveLength(1);
    expect(fileIssues[0].level).toBe('warn');
    expect(results).toHaveLength(1);
    expect(results[0].answeredCount).toBe(70);
  });

  it('l71–l90 有資料（資料是別份評量的）→ 整個檔案不能匯入', () => {
    const cols = l9d.ALL_QUESTIONS.map((q) => q.id);
    const { results, fileIssues } = validateAndScore([rowFor(c70, { columns: cols, answered: 90 })], c70);
    expect(results).toHaveLength(0);
    expect(fileIssues.find((i) => i.level === 'error').message).toMatch(/不屬於/);
  });
});

describe('逐列檢查', () => {
  it('答滿的列正常匯入，計分用該評量的設定', () => {
    const { results, errors } = validateAndScore([rowFor(c70, { value: 4 })], c70);
    expect(errors).toEqual([]);
    expect(results[0].result.assessmentId).toBe('leadership-360-70');
    expect(results[0].result.total).toBe(280);
  });

  it('缺題的列預設不匯入；勾「允許缺題」才匯入（缺題不計分）', () => {
    const partial = rowFor(c70, { answered: 60 });
    expect(validateAndScore([partial], c70).results).toHaveLength(0);
    expect(validateAndScore([partial], c70).errors[0].message).toMatch(/允許缺題/);
    const allowed = validateAndScore([partial], c70, { allowPartial: true });
    expect(allowed.results).toHaveLength(1);
    expect(allowed.results[0].answeredCount).toBe(60);
  });

  it('答案超出量表範圍的列預設不匯入', () => {
    const bad = rowFor(c70, { extra: { l3: '9' } });
    const { results, errors } = validateAndScore([bad], c70);
    expect(results).toHaveLength(0);
    expect(errors[0].message).toMatch(/超出量表範圍/);
  });

  it('身分欄位的檢查維持原樣：缺 Email、rater_type 無效、他評缺 rater_email', () => {
    const { results, errors } = validateAndScore([
      rowFor(c70, { extra: { ratee_email: '' } }),
      rowFor(c70, { extra: { rater_type: '主管' } }),
      rowFor(c70, { extra: { rater_type: 'manager', rater_email: '' } }),
    ], c70);
    expect(results).toHaveLength(0);
    expect(errors.map((e) => e.row)).toEqual([2, 3, 4]);
  });
});

describe('phase（課前／課後）欄位', () => {
  const rows = (phases) => phases.map((p, i) => rowFor(c70, { extra: { ratee_email: `p${i}@p.invalid`, phase: p } }));

  it('pre／post、中文「課前」「課後」、留空都可以；留空＝不標記階段', () => {
    const { results, errors } = validateAndScore(rows(['pre', 'POST', '課前', '課後', '前測', '後測', '', undefined]), c70);
    expect(errors).toEqual([]);
    expect(results.map((r) => r.phase)).toEqual(['pre', 'post', 'pre', 'post', 'pre', 'post', null, null]);
  });
  it('沒有 phase 欄位的舊檔案照常可以匯入（phase 為 null）', () => {
    const { results, errors, fileIssues } = validateAndScore([rowFor(c70)], c70);
    expect(fileIssues).toEqual([]); expect(errors).toEqual([]);
    expect(results[0].phase).toBeNull();
  });
  it('phase 填了其他值 → 這一列不匯入並說明；phase 欄位不會被當成多餘的題目欄位', () => {
    const { results, errors, fileIssues } = validateAndScore(rows(['pre', 'mid']), c70);
    expect(fileIssues).toEqual([]);
    expect(results).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/phase 必須為 pre \/ post/);
    expect(errors[0].message).toContain('mid');
  });
});

describe('匯入的課前／課後資料可以直接做前後測比較', () => {
  it('同一人 pre 3 分、post 4 分 → 配對 1 人、總分差 +70（70 題）', () => {
    const mk = (email, phase, value) => rowFor(c70, { value, extra: { ratee_email: email, phase } });
    const { results } = validateAndScore([mk('a@p.invalid', 'pre', 3), mk('a@p.invalid', 'post', 4), mk('b@p.invalid', 'pre', 2)], c70);
    const subs = results.map((r, i) => ({ userId: r.rateeEmail, raterType: r.raterType, phase: r.phase, createdAt: new Date(1000 + i).toISOString(), result: r.result }));
    const pp = buildPrePost(subs, c70, []);
    expect(pp.paired.n).toBe(1);
    expect(pp.paired.delta.mean).toBe(70);
    expect(pp.unpaired).toEqual({ preOnly: 1, postOnly: 0 });
  });
});

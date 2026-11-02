import { describe, it, expect } from 'vitest';
import { validateAndScore, columnReport } from '../survey/admin/batchValidation.js';
import { getAssessment } from '../survey/data/assessments/index.js';

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

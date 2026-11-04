import { describe, it, expect } from 'vitest';
import * as L9D from '../survey/data/assessments/leadership-9d.js';
import * as C70 from '../survey/data/assessments/leadership-360-70.js';
import { dimensionText, bandOf } from '../survey/utils/narrative.js';
import { buildInsights } from '../survey/utils/dimensionInsights.js';
import { build360Report } from '../survey/utils/report360.js';
import { buildResult } from '../survey/utils/scoring.js';

describe('構面層說明（DIMENSION_COMMENTARY）', () => {
  it('L9D 每個構面都有高／中／低三段文字', () => {
    for (const d of L9D.DIMENSIONS) {
      for (const b of ['high', 'mid', 'low']) {
        expect(L9D.DIMENSION_COMMENTARY[d.id]?.[b], `${d.id}.${b}`).toBeTruthy();
      }
    }
  });
  it('70 題的每個構面（含應變與創新）也都有', () => {
    for (const d of C70.DIMENSIONS) {
      for (const b of ['high', 'mid', 'low']) expect(C70.DIMENSION_COMMENTARY[d.id]?.[b], `${d.id}.${b}`).toBeTruthy();
    }
  });
  it('子能力語句涵蓋所有子能力，包含適應力的正式語句', () => {
    for (const cfg of [L9D, C70]) {
      for (const d of cfg.DIMENSIONS) for (const s of d.subDimensions) {
        for (const b of ['high', 'mid', 'low']) expect(cfg.COMMENTARY[s.id]?.[b], `${s.id}.${b}`).toBeTruthy();
      }
    }
    expect(C70.DIMENSIONS.find((d) => d.id === 'adaptive-innovation').subDimensions.map((s) => s.name)).toEqual(['因應環境變化', '創新思考']);
  });
  it('依構面平均分三段，門檻與子能力一致（4.5／3.5）', () => {
    expect(dimensionText('communication', 4.5, L9D)).toBe(L9D.DIMENSION_COMMENTARY.communication.high);
    expect(dimensionText('communication', 4.49, L9D)).toBe(L9D.DIMENSION_COMMENTARY.communication.mid);
    expect(dimensionText('communication', 3.5, L9D)).toBe(L9D.DIMENSION_COMMENTARY.communication.mid);
    expect(dimensionText('communication', 3.49, L9D)).toBe(L9D.DIMENSION_COMMENTARY.communication.low);
    expect(bandOf(4.25)).toBe('mid'); // 原 Excel 4.25–4.5 的空窗：歸入中段
  });
  it('題庫沒有設定、或構面不存在時回傳 null（呼叫端退回通用說明）', () => {
    expect(dimensionText('communication', 4, {})).toBeNull();
    expect(dimensionText('nope', 4, L9D)).toBeNull();
  });
});

describe('構面落差提示（任務管理 × 執行力）', () => {
  const dims = (tm, ex) => [{ id: 'task-management', average: tm }, { id: 'execution', average: ex }];
  it('任務管理 < 3.5、執行力 ≥ 3.5 且落差 ≥ 0.7 時觸發，附三個建議課程', () => {
    const r = buildInsights(dims(3.0, 4.2));
    expect(r).toHaveLength(1);
    expect(r[0].courses).toHaveLength(3);
    expect(r[0].text).toMatch(/規劃/);
  });
  it('邊界：任務管理剛好 3.5、落差不足 0.7、執行力低於 3.5 都不觸發', () => {
    expect(buildInsights(dims(3.5, 4.5))).toEqual([]);
    expect(buildInsights(dims(3.0, 3.6))).toEqual([]);
    expect(buildInsights(dims(2.0, 3.4))).toEqual([]);
  });
  it('缺少構面或平均為 0（沒有作答）不觸發、不丟錯', () => {
    expect(buildInsights([{ id: 'execution', average: 4.5 }])).toEqual([]);
    expect(buildInsights(dims(0, 4.5))).toEqual([]);
    expect(buildInsights(undefined)).toEqual([]);
  });
});

describe('360° 報告帶出構面說明與落差提示', () => {
  const answersWith = (cfg, valueOf) => Object.fromEntries(cfg.DIMENSIONS.flatMap((d) => d.questions.map((q) => [q.id, valueOf(d.id)])));
  const sub = (answers, extra = {}) => ({ createdAt: '2026-11-01T00:00:00Z', userId: 'u1', raterType: 'self', result: buildResult(answers, C70), ...extra });
  it('他評（主管）任務管理低、執行力高 → insights 與 dimTexts 都有', () => {
    const ans = answersWith(C70, (id) => (id === 'task-management' ? 2 : id === 'execution' ? 5 : 4));
    const report = build360Report([
      sub(answersWith(C70, () => 4)),
      sub(ans, { userId: 'm1', raterType: 'manager' }),
    ], C70);
    expect(report.insights.map((i) => i.id)).toEqual(['execution-over-task-management']);
    expect(report.dimTexts['task-management']).toBe(C70.DIMENSION_COMMENTARY['task-management'].low);
    expect(report.dimTexts.execution).toBe(C70.DIMENSION_COMMENTARY.execution.high);
  });
});

describe('發展行動計畫：三個階段的建議不逐字重複', () => {
  it('全部高分時，各階段的建議依構面名稱不同', async () => {
    const { buildDevelopmentPlan } = await import('../survey/utils/narrative.js');
    const answers = Object.fromEntries(L9D.ALL_QUESTIONS.map((q) => [q.id, q.reversed ? 1 : 5]));
    const plan = buildDevelopmentPlan(buildResult(answers, L9D), L9D);
    expect(plan.length).toBeGreaterThanOrEqual(2);
    const all = plan.flatMap((p) => p.actions);
    expect(new Set(all).size).toBe(all.length);
  });
  it('低分構面的第一條建議是該構面專屬的', async () => {
    const { buildDevelopmentPlan } = await import('../survey/utils/narrative.js');
    const { DIM_DEVELOPMENT } = await import('../survey/components/printable-report/tokens.js');
    const answers = Object.fromEntries(L9D.DIMENSIONS.flatMap((d) => d.questions.map((q) => [q.id, d.id === 'execution' ? (q.reversed ? 5 : 1) : (q.reversed ? 2 : 4)])));
    const plan = buildDevelopmentPlan(buildResult(answers, L9D), L9D);
    expect(plan[0].id).toBe('execution');
    expect(plan[0].actions[0]).toBe(DIM_DEVELOPMENT.execution.action);
  });
});

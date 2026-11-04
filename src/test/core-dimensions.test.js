import { describe, it, expect } from 'vitest';
import * as L9D from '../survey/data/assessments/leadership-9d.js';
import * as L8D from '../survey/data/assessments/leadership-360-70.js';
import { buildResult } from '../survey/utils/scoring.js';
import { CORE_DIMENSION_IDS, coreAverages, coreByAssessment, pairedCore } from '../survey/utils/coreDimensions.js';

const all = (cfg, v) => Object.fromEntries(cfg.ALL_QUESTIONS.map((q) => [q.id, q.reversed ? 6 - v : v]));
const sub = (cfg, v, userId, createdAt = '2026-11-01T00:00:00Z') => ({ assessmentId: cfg.ID, userId, raterType: 'self', createdAt, result: buildResult(all(cfg, v), cfg) });

describe('核心 7 構面', () => {
  it('是兩套評量都有的構面；專屬構面不在其中', () => {
    const ids = (cfg) => cfg.DIMENSIONS.map((d) => d.id);
    CORE_DIMENSION_IDS.forEach((id) => { expect(ids(L9D)).toContain(id); expect(ids(L8D)).toContain(id); });
    expect(CORE_DIMENSION_IDS).toHaveLength(7);
    ['critical-thinking', 'succession-readiness', 'adaptive-innovation'].forEach((id) => expect(CORE_DIMENSION_IDS).not.toContain(id));
    // 反過來：兩套共有的構面剛好就是這 7 個，沒有漏掉的
    const common = ids(L9D).filter((id) => ids(L8D).includes(id)).sort();
    expect(common).toEqual([...CORE_DIMENSION_IDS].sort());
  });
  it('coreAverages 只取核心構面，平均 0（沒作答）不列入', () => {
    const a = coreAverages(buildResult(all(L8D, 4), L8D));
    expect(Object.keys(a).sort()).toEqual([...CORE_DIMENSION_IDS].sort());
    expect(coreAverages({ dimensions: [{ id: 'communication', average: 0 }] })).toEqual({});
  });
  it('coreByAssessment：每人每份評量取最新一筆，再對人平均', () => {
    const rows = coreByAssessment([
      sub(L9D, 2, 'u1', '2026-10-01T00:00:00Z'), sub(L9D, 4, 'u1', '2026-11-01T00:00:00Z'), sub(L9D, 5, 'u2'),
      sub(L8D, 3, 'u1'),
    ]);
    const l9 = rows.find((r) => r.assessmentId === L9D.ID);
    expect(l9.n).toBe(2);
    expect(l9.dims.communication).toBe(4.5); // (4 + 5) / 2；u1 較舊的 2 分不算
    expect(rows.find((r) => r.assessmentId === L8D.ID).dims.execution).toBe(3);
  });
  it('只有風格型等沒有核心構面的評量不會被列入', () => {
    expect(coreByAssessment([{ assessmentId: 'disc', userId: 'u', createdAt: '2026-11-01T00:00:00Z', result: { dimensions: [{ id: 'D', average: 3 }] } }])).toEqual([]);
  });
  it('pairedCore：同一人兩份都做過才比；差 = B − A；沒有人兩份都做過回 null', () => {
    expect(pairedCore([sub(L9D, 4, 'u1'), sub(L8D, 3, 'u2')], L9D.ID, L8D.ID)).toBeNull();
    const p = pairedCore([sub(L9D, 4, 'u1'), sub(L8D, 3, 'u1'), sub(L9D, 5, 'u3')], L9D.ID, L8D.ID);
    expect(p.n).toBe(1);
    expect(p.dims.execution).toEqual({ a: 4, b: 3, diff: -1 });
  });
});

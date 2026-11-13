import { describe, it, expect } from 'vitest';
import { badgeText, stageOf, STAGE_NAMES, STAGE_HEADLINES } from '../survey/utils/levelBadge.js';
import { getAssessment } from '../survey/data/assessments/index.js';

describe('落點徽章顯示（榕光）', () => {
  it('去掉開頭的 emoji 與空白，其餘文字不動', () => {
    expect(badgeText('🚀 AI 數位高潛力股')).toBe('AI 數位高潛力股');
    expect(badgeText('🖋️ 靜謐詩人')).toBe('靜謐詩人');
    expect(badgeText('課後問卷已完成')).toBe('課後問卷已完成');
    expect(badgeText('')).toBe('');
  });
  it('四級題庫對映成長階段 0–3；沒有等級列表的題庫回傳 null', () => {
    const ai = getAssessment('ai-competency');
    expect(ai.LEVELS.map((l) => stageOf(l, ai))).toEqual([0, 1, 2, 3]);
    expect(stageOf(ai.LEVELS[2], getAssessment('disc'))).toBeNull();
    expect(stageOf(null, ai)).toBeNull();
    expect(STAGE_NAMES).toHaveLength(4);
    expect(STAGE_HEADLINES).toHaveLength(4);
  });
  it('所有題庫的等級都能對映到 0–3（不會落到範圍外）', () => {
    for (const id of ['ai-competency', 'leadership-9d', 'leadership-360-70']) {
      const c = getAssessment(id);
      for (const l of c.LEVELS) expect([0, 1, 2, 3]).toContain(stageOf(l, c));
    }
  });
});

import { describe, it, expect } from 'vitest';
import { buildCommentDraft, buildGroupCommentDraft, DRAFT_MARKER } from '../survey/utils/commentDraft.js';

const dims = [
  { id: 'communication', name: '溝通力', subtitle: 'Communication', average: 4.6 },
  { id: 'collaboration', name: '協作關係', subtitle: 'Collaboration', average: 4.0 },
  { id: 'execution', name: '執行力', subtitle: 'Execution', average: 2.4 },
];

describe('評語草稿', () => {
  it('個人草稿：開頭有草稿標示、先肯定優勢、再說最低構面、附兩個行動；不出現否定字眼', () => {
    const d = buildCommentDraft({ assessmentId: 'leadership-9d', dimensions: dims });
    expect(d.text.startsWith(DRAFT_MARKER)).toBe(true);
    expect(d.text.indexOf('溝通力')).toBeLessThan(d.text.indexOf('執行力'));
    expect(d.text).toContain('不是因為做得差');
    expect(d.tips).toHaveLength(2);
    expect(d.text).not.toMatch(/很差|不及格|失敗/);
  });

  it('360° 的盲點與被低估的優勢會進草稿', () => {
    const d = buildCommentDraft({ assessmentId: 'leadership-9d', dimensions: dims }, { threeSixty: { blind: [{ name: '任務管理' }], hidden: [{ name: '人才發展' }] } });
    expect(d.text).toContain('人才發展');
    expect(d.text).toContain('任務管理');
  });

  it('沒有資料時只有標示；全班草稿用最強與最弱構面', () => {
    expect(buildCommentDraft({ dimensions: [] }).text).toBe(DRAFT_MARKER);
    const g = buildGroupCommentDraft({ assessmentId: 'leadership-9d', respondents: 5, dimensionAverages: [
      { id: 'communication', name: '溝通力', subtitle: 'Communication', percent: 90 },
      { id: 'collaboration', name: '協作關係', subtitle: 'Collaboration', percent: 70 },
      { id: 'execution', name: '執行力', subtitle: 'Execution', percent: 50 },
    ] });
    expect(g.text).toContain('溝通力');
    expect(g.text).toContain('執行力');
    expect(g.tips.length).toBeGreaterThan(0);
    expect(buildGroupCommentDraft({ respondents: 0, dimensionAverages: [] }).text).toBe(DRAFT_MARKER);
  });
});

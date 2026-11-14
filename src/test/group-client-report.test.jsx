import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import GroupPrintableReport from '../survey/components/GroupPrintableReport.jsx';
import { buildPrePost } from '../survey/utils/prePost.js';
import { buildExecutiveSummary, buildPrePostChapter, MIN_PAIRED } from '../survey/utils/groupSummary.js';
import { aggregateStats } from '../survey/utils/analytics.js';
import { getAssessment } from '../survey/data/assessments/index.js';
import { buildResult } from '../survey/utils/scoring.js';

vi.mock('../survey/api/client', () => ({ api: { getCourseSurveySummary: vi.fn().mockResolvedValue({ attached: false }) } }));

const cfg = getAssessment('leadership-9d');
const res = (v) => buildResult(Object.fromEntries(cfg.ALL_QUESTIONS.map((q) => [q.id, v])), cfg);
const users = ['甲', '乙', '丙', '丁'].map((n, i) => ({ id: `u${i}`, name: `學員${n}`, email: `u${i}@x.com` }));
const sub = (u, phase, v, day) => ({ id: `${u.id}-${phase}`, userId: u.id, userName: u.name, assessmentId: 'leadership-9d', raterType: 'self', phase, createdAt: `2026-11-${day}T00:00:00Z`, result: res(v) });
const full = users.flatMap((u) => [sub(u, 'pre', 3, '01'), sub(u, 'post', 4, '10')]);
const group = { id: 'g1', name: '測試班', assessmentId: 'leadership-9d', memberIds: users.map((u) => u.id) };

describe('客戶版成效報告', () => {
  let portal;
  beforeEach(() => { portal = document.createElement('div'); portal.id = 'report-portal'; document.body.appendChild(portal); });
  afterEach(() => portal.remove());

  it('摘要：參與率、優勢與發展構面各三個、有前後變化', () => {
    const stats = aggregateStats(full, cfg);
    const s = buildExecutiveSummary({ stats, memberCount: 4, prepost: buildPrePost(full, cfg, users) });
    expect(s.participation).toBe(100);
    expect(s.strengths).toHaveLength(3);
    expect(s.priorities).toHaveLength(3);
    expect(s.change.n).toBe(4);
    expect(s.change.meanDelta).toBeGreaterThan(0);
  });

  it('配對人數少於門檻：不出現前後比較章節', () => {
    const few = users.slice(0, MIN_PAIRED - 1).flatMap((u) => [sub(u, 'pre', 3, '01'), sub(u, 'post', 4, '10')]);
    expect(buildPrePostChapter(buildPrePost(few, cfg, users))).toBeNull();
    expect(buildPrePostChapter(buildPrePost(full, cfg, users)).n).toBe(4);
  });

  it('預設客戶版：有摘要與前後比較，沒有成員排名與個別頁；切教練版才出現', () => {
    render(<GroupPrintableReport group={group} submissions={full} users={users} onClose={() => {}} />);
    const text = () => portal.textContent;
    expect(text()).toContain('給管理者的一頁摘要');
    expect(text()).toContain('課前課後比較');
    expect(text()).not.toContain('成員排名總覽');
    expect(text()).not.toContain('學員甲');
    expect(text()).toContain('客戶版');
    fireEvent.click(screen.getByRole('button', { name: /切到教練版/ }));
    expect(text()).toContain('成員排名總覽');
    expect(text()).toContain('學員甲');
    expect(text()).toContain('教練版');
  });

  it('沒有課後資料：不出現前後比較，也不報錯', () => {
    const pre = users.map((u) => sub(u, 'pre', 3, '01'));
    render(<GroupPrintableReport group={group} submissions={pre} users={users} onClose={() => {}} />);
    expect(portal.textContent).not.toContain('課前課後比較');
    expect(portal.textContent).toContain('給管理者的一頁摘要');
  });
});

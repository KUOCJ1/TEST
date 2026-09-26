import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import AnalyticsTab from '../survey/admin/AnalyticsTab';
import { buildResult } from '../survey/utils/scoring';
import { getAssessment } from '../survey/data/assessments/index.js';

vi.mock('../survey/api/client', () => ({ api: { adminLearningResourceStats: vi.fn().mockResolvedValue([]) } }));

// Sprint 7 驗收條件 7.8：風格型題庫的整體統計不暗示高低。

const disc = getAssessment('disc');
const ai = getAssessment('ai-competency');

function discFavoring(dimId) {
  const answers = {};
  disc.DIMENSIONS.forEach((d) => d.questions.forEach((q) => { answers[q.id] = d.id === dimId ? 5 : 1; }));
  return buildResult(answers, disc);
}
const users = [{ id: 'u1', name: '小明', email: 'm@x.co', role: 'user' }, { id: 'u2', name: '小華', email: 'h@x.co', role: 'user' }];
const sub = (userId, assessmentId, result) => ({ id: `${userId}-${assessmentId}`, userId, assessmentId, raterType: 'self', createdAt: '2026-09-01T00:00:00Z', result });

describe('AnalyticsTab：風格型題庫', () => {
  it('DISC：KPI 顯示最常見風格、不顯示達成率；明細表沒有總分／達成率欄位', () => {
    const r = discFavoring('dominance');
    render(
      <AnalyticsTab
        users={users}
        adminAssessments={[{ id: 'disc', name: 'DISC 行為風格評測' }]}
        submissions={[sub('u1', 'disc', r), sub('u2', 'disc', r)]}
      />,
    );
    expect(screen.getByText('最常見風格')).toBeInTheDocument();
    expect(screen.getAllByText(r.level.badge).length).toBeGreaterThan(0);
    expect(screen.queryByText(/達成率/)).not.toBeInTheDocument();
    expect(screen.getByText('各構面平均傾向強度')).toBeInTheDocument();
    expect(screen.getByText('風格人數分佈')).toBeInTheDocument();
    const header = screen.getByText('填答者明細').closest('section').querySelector('thead');
    expect(within(header).queryByText('總分')).not.toBeInTheDocument();
    expect(within(header).getByText('風格')).toBeInTheDocument();
  });

  it('一般題庫維持原樣：平均達成率、總分、達成率欄位都在', () => {
    const r = buildResult(Object.fromEntries(ai.ALL_QUESTIONS.map((q) => [q.id, 4])), ai);
    render(
      <AnalyticsTab
        users={users}
        adminAssessments={[{ id: 'ai-competency', name: 'AI 職能' }]}
        submissions={[sub('u1', 'ai-competency', r)]}
      />,
    );
    expect(screen.getByText('平均達成率')).toBeInTheDocument();
    expect(screen.getByText('各構面平均達成率')).toBeInTheDocument();
    const header = screen.getByText('填答者明細').closest('section').querySelector('thead');
    expect(within(header).getByText('總分')).toBeInTheDocument();
    expect(within(header).getByText('落點等級')).toBeInTheDocument();
  });
});

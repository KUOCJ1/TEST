import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CohortTrendSection from '../survey/admin/CohortTrendSection';
import { buildResult } from '../survey/utils/scoring';
import { getAssessment } from '../survey/data/assessments/index.js';

const ai = getAssessment('ai-competency');
const disc = getAssessment('disc');

function uniform(config, value) {
  return buildResult(Object.fromEntries(config.ALL_QUESTIONS.map((q) => [q.id, value])), config);
}
function discFavoring(dimId) {
  const answers = {};
  disc.DIMENSIONS.forEach((d) => d.questions.forEach((q) => { answers[q.id] = d.id === dimId ? 5 : 1; }));
  return buildResult(answers, disc);
}
const sub = (userId, groupId, result, extra = {}) => ({
  userId, groupId, raterType: 'self', phase: 'pre', assessmentId: result.assessmentId ?? 'ai-competency',
  createdAt: '2026-01-01T00:00:00Z', result, ...extra,
});
const group = (id, name, startDate, assessmentId = 'ai-competency') =>
  ({ id, name, startDate, assessmentId, memberIds: [], coachName: '王教練' });

describe('CohortTrendSection', () => {
  it('一般題庫：依開課日列出各梯達成率，並寫出最新一梯與第一梯的差距', () => {
    const groups = [group('b', '六月梯', '2026-06-01'), group('a', '三月梯', '2026-03-01')];
    const subs = [sub('u1', 'a', uniform(ai, 2)), sub('u2', 'b', uniform(ai, 4))];
    render(<CohortTrendSection groups={groups} submissions={subs} config={ai} />);

    const names = screen.getAllByText(/月梯$/).map((el) => el.textContent);
    expect(names).toEqual(['三月梯', '六月梯']);
    const lo = uniform(ai, 2).percent;
    const hi = uniform(ai, 4).percent;
    expect(screen.getByText(new RegExp(`最新一梯「六月梯」課前平均達成率 ${hi}%`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`高 ${hi - lo} 個百分點`))).toBeInTheDocument();
  });

  it('切換到課後只看課後作答', () => {
    const groups = [group('a', '三月梯', '2026-03-01')];
    const subs = [sub('u1', 'a', uniform(ai, 2))];
    render(<CohortTrendSection groups={groups} submissions={subs} config={ai} />);
    expect(screen.getByText('三月梯')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '課後' }));
    expect(screen.queryByText('三月梯')).not.toBeInTheDocument();
    expect(screen.getByText(/沒有任何班級有課後作答資料/)).toBeInTheDocument();
    expect(screen.getByText(/另有 1 個班級尚無課後作答資料/)).toBeInTheDocument();
  });

  it('只有 1 個班級時提示至少需要 2 個才看得出趨勢，也不顯示差距', () => {
    render(<CohortTrendSection groups={[group('a', '三月梯', '2026-03-01')]} submissions={[sub('u1', 'a', uniform(ai, 3))]} config={ai} />);
    expect(screen.getByText(/至少需要 2 個班級/)).toBeInTheDocument();
    expect(screen.queryByText(/最新一梯/)).not.toBeInTheDocument();
  });

  it('風格型題庫（DISC）不顯示達成率與差距，改列各梯風格分布', () => {
    const groups = [group('a', '三月梯', '2026-03-01', 'disc'), group('b', '六月梯', '2026-06-01', 'disc')];
    const subs = [
      sub('u1', 'a', discFavoring('dominance'), { assessmentId: 'disc' }),
      sub('u2', 'b', discFavoring('steadiness'), { assessmentId: 'disc' }),
    ];
    const { container } = render(<CohortTrendSection groups={groups} submissions={subs} config={disc} />);

    expect(container).not.toHaveTextContent('達成率');
    expect(container).not.toHaveTextContent('百分點');
    const march = screen.getByText('三月梯').closest('li');
    expect(within(march).getByText(/1 人$/)).toBeInTheDocument();
    expect(march).toHaveTextContent(subs[0].result.level.badge);
  });
});

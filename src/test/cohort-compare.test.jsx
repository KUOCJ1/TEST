import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CohortCompare from '../survey/coach/CohortCompare';
import { getAssessment } from '../survey/data/assessments/index.js';
import { buildResult } from '../survey/utils/scoring';

const config = getAssessment('ai-competency');

function resultFor(value) {
  return buildResult(Object.fromEntries(config.ALL_QUESTIONS.map((q) => [q.id, value])), config);
}

const { getGroup } = vi.hoisted(() => ({ getGroup: vi.fn() }));
vi.mock('../survey/api/client', () => ({ api: { getGroup } }));

const groups = [
  { id: 'g1', name: '第一梯', assessmentId: 'ai-competency' },
  { id: 'g2', name: '第二梯', assessmentId: 'ai-competency' },
  { id: 'g3', name: '不同題庫的班', assessmentId: 'leadership-9d' },
];

describe('CohortCompare', () => {
  it('只列出跟目前選擇的題庫相同的班級可選', () => {
    render(<CohortCompare groups={groups} onClose={vi.fn()} />);
    const selectA = screen.getByLabelText('梯次 A');
    expect(within(selectA).queryByText('不同題庫的班')).not.toBeInTheDocument();
    expect(within(selectA).getByText('第一梯')).toBeInTheDocument();
  });

  it('選同一個班兩次會顯示錯誤，不會呼叫 API', async () => {
    render(<CohortCompare groups={groups} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('梯次 A'), { target: { value: 'g1' } });
    fireEvent.change(screen.getByLabelText('梯次 B'), { target: { value: 'g1' } });
    fireEvent.click(screen.getByRole('button', { name: '開始比較' }));
    expect(await screen.findByText('請選擇兩個不同的班級')).toBeInTheDocument();
    expect(getGroup).not.toHaveBeenCalled();
  });

  it('選兩個不同班級後顯示雙方的平均總分與人數', async () => {
    getGroup.mockImplementation(async (id) => {
      if (id === 'g1') return { group: { id: 'g1', name: '第一梯' }, submissions: [{ userId: 'u1', result: resultFor(5) }] };
      return { group: { id: 'g2', name: '第二梯' }, submissions: [{ userId: 'u2', result: resultFor(1) }, { userId: 'u3', result: resultFor(3) }] };
    });
    render(<CohortCompare groups={groups} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('梯次 A'), { target: { value: 'g1' } });
    fireEvent.change(screen.getByLabelText('梯次 B'), { target: { value: 'g2' } });
    fireEvent.click(screen.getByRole('button', { name: '開始比較' }));

    expect(await screen.findByText('1 人作答')).toBeInTheDocument();
    expect(screen.getByText('2 人作答')).toBeInTheDocument();
  });

  it('點關閉會呼叫 onClose', () => {
    const onClose = vi.fn();
    render(<CohortCompare groups={groups} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '關閉' }));
    expect(onClose).toHaveBeenCalled();
  });
});


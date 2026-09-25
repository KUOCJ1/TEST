import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NextStepCard from '../survey/components/NextStepCard';
import GroupStatusBar from '../survey/components/GroupStatusBar';
import GoalProgressChip from '../survey/components/GoalProgressChip';

describe('NextStepCard', () => {
  it('nextStep 為 null 時不渲染任何東西', () => {
    const { container } = render(<NextStepCard nextStep={null} onStartSurvey={vi.fn()} onGoTo360={vi.fn()} onViewAnalysis={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('kind=pre：顯示課前文案，點擊呼叫 onStartSurvey', () => {
    const onStartSurvey = vi.fn();
    render(
      <NextStepCard
        nextStep={{ kind: 'pre', assessmentId: 'leadership-9d', assessmentName: 'L9D', groupId: 'g1' }}
        onStartSurvey={onStartSurvey}
        onGoTo360={vi.fn()}
        onViewAnalysis={vi.fn()}
      />,
    );
    expect(screen.getByText(/開始「L9D」課前評測/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /開始課前評測/ }));
    expect(onStartSurvey).toHaveBeenCalledWith('leadership-9d');
  });

  it('kind=rate-others：顯示待評人數，點擊呼叫 onGoTo360', () => {
    const onGoTo360 = vi.fn();
    render(
      <NextStepCard
        nextStep={{ kind: 'rate-others', assessmentId: 'leadership-9d', assessmentName: 'L9D', count: 3 }}
        onStartSurvey={vi.fn()}
        onGoTo360={onGoTo360}
        onViewAnalysis={vi.fn()}
      />,
    );
    expect(screen.getByText('還有 3 位同事等你評分')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /前往評測他人/ }));
    expect(onGoTo360).toHaveBeenCalledWith('leadership-9d');
  });

  it('kind=retest-reminder：顯示目標文字，點擊呼叫 onStartSurvey', () => {
    const onStartSurvey = vi.fn();
    render(
      <NextStepCard
        nextStep={{ kind: 'retest-reminder', assessmentId: 'leadership-9d', assessmentName: 'L9D', goalText: '每週練習表達' }}
        onStartSurvey={onStartSurvey}
        onGoTo360={vi.fn()}
        onViewAnalysis={vi.fn()}
      />,
    );
    expect(screen.getByText(/每週練習表達/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /開始複測/ }));
    expect(onStartSurvey).toHaveBeenCalledWith('leadership-9d');
  });

  it('kind=view-report：點擊呼叫 onViewAnalysis', () => {
    const onViewAnalysis = vi.fn();
    render(
      <NextStepCard
        nextStep={{ kind: 'view-report', assessmentId: 'disc', assessmentName: 'DISC' }}
        onStartSurvey={vi.fn()}
        onGoTo360={vi.fn()}
        onViewAnalysis={onViewAnalysis}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /查看我的分析/ }));
    expect(onViewAnalysis).toHaveBeenCalledWith('disc');
  });
});

describe('GroupStatusBar', () => {
  it('group 為 null 時不渲染', () => {
    const { container } = render(<GroupStatusBar group={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('顯示班名、教練與階段', () => {
    render(<GroupStatusBar group={{ name: '2026 秋季班', coachName: '王教練', phase: 'in_progress' }} />);
    expect(screen.getByText('2026 秋季班')).toBeInTheDocument();
    expect(screen.getByText('教練：王教練')).toBeInTheDocument();
    expect(screen.getByText('進行中')).toBeInTheDocument();
  });

  it('進行中且有 endDate 時顯示倒數天數', () => {
    const endDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    render(<GroupStatusBar group={{ name: '班', phase: 'in_progress', endDate }} />);
    expect(screen.getByText(/還有 \d 天截止/)).toBeInTheDocument();
  });

  it('非進行中階段不顯示倒數', () => {
    const endDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    render(<GroupStatusBar group={{ name: '班', phase: 'closed', endDate }} />);
    expect(screen.queryByText(/還有 \d 天截止/)).not.toBeInTheDocument();
  });
});

describe('GoalProgressChip', () => {
  it('沒有進行中目標時不渲染', () => {
    const { container } = render(<GoalProgressChip goals={[]} onClick={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('顯示進行中目標數與行動完成率，點擊觸發 onClick', () => {
    const onClick = vi.fn();
    const goals = [
      { achievedAt: null, actions: [{ done: true }, { done: false }] },
      { achievedAt: null, actions: [{ done: true }] },
      { achievedAt: '2026-01-01', actions: [{ done: true }] }, // 已達成，不計入
    ];
    render(<GoalProgressChip goals={goals} onClick={onClick} />);
    expect(screen.getByText(/2 個進行中/)).toBeInTheDocument();
    expect(screen.getByText(/行動完成率 67%/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

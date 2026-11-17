import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NextStepCard from '../survey/components/NextStepCard';
import GroupStatusBar from '../survey/components/GroupStatusBar';

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

describe('NextStepCard：先練習，再複測', () => {
  it('keep-going：不說「該回來複測了」，說明大約何時複測，按鈕去我的學習', () => {
    const onGoToLearning = vi.fn();
    render(<NextStepCard nextStep={{ kind: 'keep-going', assessmentId: 'leadership-9d', assessmentName: 'X', retestAt: '2026-12-08T00:00:00Z' }} onStartSurvey={vi.fn()} onGoTo360={vi.fn()} onViewAnalysis={vi.fn()} onGoToLearning={onGoToLearning} />);
    expect(screen.getByText('先練習，過一陣子再複測')).toBeInTheDocument();
    expect(screen.queryByText(/該回來複測了/)).toBeNull();
    expect(screen.getByText(/2026\/12\/08 之後再做課後複測/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /看這週的小步/ }));
    expect(onGoToLearning).toHaveBeenCalledTimes(1);
  });
});

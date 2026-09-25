import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AssessmentCard from '../survey/components/AssessmentCard';

const assessment = { id: 'ai-competency', name: 'AI 全方位職能實戰課前評測', description: '6 大構面、37 題' };

const noop = { onStart: vi.fn(), onViewAnalysis: vi.fn(), onGoTo360: vi.fn() };

describe('AssessmentCard 狀態標籤', () => {
  it('沒有作答紀錄、不屬於任何班別 → 「未作答」', () => {
    render(<AssessmentCard assessment={assessment} latestSubmission={null} groupPhase={null} submittedPhases={null} {...noop} />);
    expect(screen.getByText('未作答')).toBeInTheDocument();
  });

  it('屬於班別、只完成課前 → 「課前已完成」', () => {
    render(
      <AssessmentCard
        assessment={assessment}
        latestSubmission={{ createdAt: '2026-01-01', result: { total: 100, maxScore: 150, level: { badge: 'X', color: '#000' } } }}
        groupPhase="in_progress"
        submittedPhases={new Set(['pre'])}
        {...noop}
      />,
    );
    expect(screen.getByText('課前已完成')).toBeInTheDocument();
  });

  it('屬於班別、課前課後都完成 → 「課後已完成」', () => {
    render(
      <AssessmentCard
        assessment={assessment}
        latestSubmission={{ createdAt: '2026-01-01', result: { total: 100, maxScore: 150, level: { badge: 'X', color: '#000' } } }}
        groupPhase="in_progress"
        submittedPhases={new Set(['pre', 'post'])}
        {...noop}
      />,
    );
    expect(screen.getByText('課後已完成')).toBeInTheDocument();
  });

  it('不屬於任何班別但有作答紀錄（自主重測）→ 「可重測」', () => {
    render(
      <AssessmentCard
        assessment={assessment}
        latestSubmission={{ createdAt: '2026-01-01', result: { total: 100, maxScore: 150, level: { badge: 'X', color: '#000' } } }}
        groupPhase={null}
        submittedPhases={null}
        {...noop}
      />,
    );
    expect(screen.getByText('可重測')).toBeInTheDocument();
  });
});

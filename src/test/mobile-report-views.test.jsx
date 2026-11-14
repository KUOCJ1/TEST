import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThreeSixtyReadView, BatchReadView } from '../survey/components/MobileReportViews.jsx';
import { build360Report } from '../survey/utils/report360.js';
import { getAssessment } from '../survey/data/assessments/index.js';
import { buildResult } from '../survey/utils/scoring.js';

const cfg = getAssessment('leadership-360-70');
const res = (v) => buildResult(Object.fromEntries(cfg.ALL_QUESTIONS.map((q) => [q.id, v])), cfg);
const sub = (raterType, userId, v) => ({ userId, raterType, createdAt: '2026-11-01T00:00:00Z', result: res(v) });

describe('手機閱讀版：360° 與批次', () => {
  it('360° 閱讀版：有自評與他評時顯示盲點區塊、各構面與發展建議', () => {
    const report = build360Report([sub('self', 'r', 5), sub('manager', 'm', 3)], cfg);
    render(<ThreeSixtyReadView report={report} name="受評者" date="2026/11/14" />);
    expect(screen.getByText('受評者')).toBeInTheDocument();
    expect(screen.getByText('可能的盲點（自評高於他評）')).toBeInTheDocument();
    expect(screen.getByLabelText('構面詳述').querySelectorAll('article')).toHaveLength(8);
    expect(screen.getByLabelText('發展建議')).toBeInTheDocument();
  });

  it('360° 閱讀版：只有自評時不出現盲點區塊', () => {
    const report = build360Report([sub('self', 'r', 4)], cfg);
    render(<ThreeSixtyReadView report={report} name="受評者" date="2026/11/14" />);
    expect(screen.queryByText('可能的盲點（自評高於他評）')).toBeNull();
  });

  it('批次閱讀版：點開才渲染該員報告', () => {
    const members = [1, 2].map((i) => ({ name: `學員${i}`, email: `a${i}@x.com`, submission: { id: `s${i}`, createdAt: '2026-11-01T00:00:00Z', result: res(3), comments: [] } }));
    render(<BatchReadView members={members} benchmark={null} />);
    expect(screen.queryByText('個人評測報告')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /學員1/ })[0]);
    expect(screen.getByText('個人評測報告')).toBeInTheDocument();
  });
});

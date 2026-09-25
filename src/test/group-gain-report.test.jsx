import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GroupGainReport from '../survey/coach/GroupGainReport';
import { getAssessment } from '../survey/data/assessments/index.js';
import { buildResult } from '../survey/utils/scoring';

const config = getAssessment('ai-competency');
const discConfig = getAssessment('disc');

function resultFavoring(cfg, dimId, value = 5, otherValue = 1) {
  const answers = {};
  cfg.DIMENSIONS.forEach((d) => {
    d.questions.forEach((q) => { answers[q.id] = d.id === dimId ? value : otherValue; });
  });
  return buildResult(answers, cfg);
}

function selfSub(userId, phase, result, order) {
  return { id: `s${order}`, userId, raterType: 'self', phase, createdAt: new Date(2026, 0, order).toISOString(), result };
}

describe('GroupGainReport', () => {
  it('沒有配對樣本時不渲染任何東西', () => {
    const { container } = render(
      <GroupGainReport group={{ assessmentId: 'ai-competency' }} submissions={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('一般題庫：顯示平均總分增益與進步最多/最少的構面', () => {
    const submissions = [
      selfSub('u1', 'pre', resultFavoring(config, 'foundation', 1, 1), 1),
      selfSub('u1', 'post', resultFavoring(config, 'foundation', 5, 1), 2),
    ];
    render(<GroupGainReport group={{ assessmentId: 'ai-competency' }} submissions={submissions} />);
    expect(screen.getByText('班級學習成效')).toBeInTheDocument();
    expect(screen.getByText('配對樣本 1 人（課前＋課後皆完成）')).toBeInTheDocument();
    expect(screen.getByText('進步最多')).toBeInTheDocument();
  });

  it('PROFILE_MODE 題庫：顯示風格分布，不顯示總分增益數字', () => {
    const submissions = [
      selfSub('u1', 'pre', resultFavoring(discConfig, 'dominance'), 1),
      selfSub('u1', 'post', resultFavoring(discConfig, 'steadiness'), 2),
    ];
    render(<GroupGainReport group={{ assessmentId: 'disc' }} submissions={submissions} />);
    expect(screen.getByText('課前風格分布')).toBeInTheDocument();
    expect(screen.getByText('課後風格分布')).toBeInTheDocument();
    expect(screen.queryByText('班級平均總分增益')).not.toBeInTheDocument();
  });
});

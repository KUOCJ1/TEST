import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrintableReport from '../survey/components/PrintableReport';
import { buildResult } from '../survey/utils/scoring';
import { getAssessment } from '../survey/data/assessments/index.js';

// PrintableReport 以 createPortal 掛到 #report-portal，測試前後自行準備／清掉。
let portal;
beforeEach(() => {
  portal = document.createElement('div');
  portal.id = 'report-portal';
  document.body.appendChild(portal);
});
afterEach(() => {
  portal.remove();
});

function renderFor(assessmentId, value = 4) {
  const config = getAssessment(assessmentId);
  const answers = Object.fromEntries(config.ALL_QUESTIONS.map((q) => [q.id, value]));
  const result = buildResult(answers, config);
  render(
    <PrintableReport
      result={result}
      benchmark={null}
      user={{ name: '測試員', email: 't@example.com' }}
      submittedAt="2026-01-01T00:00:00.000Z"
      onClose={() => {}}
    />,
  );
  return { config, result };
}

describe('PrintableReport 依題庫設定產出內容', () => {
  // 迴歸測試：這支元件同時服務多個題庫，過去把 L9D 的評量名稱、構面數、
  // 分數區間與落點等級寫死，導致 AI 職能評測的 PDF 全部標成「L9D 領導力評量」。
  it('AI 職能評測不應出現任何 L9D 專屬字樣', () => {
    renderFor('ai-competency');
    const text = portal.textContent;

    for (const stale of ['L9D', '領導力評量', '九大構面', '90–450', '卓越領導者', 'Leadership Assessment']) {
      expect(text, `不應包含 L9D 專屬字樣「${stale}」`).not.toContain(stale);
    }
  });

  it('AI 職能評測顯示自己的評量名稱、構面數與分數區間', () => {
    const { config } = renderFor('ai-competency');

    expect(portal.textContent).toContain(config.NAME);
    expect(portal.textContent).toContain(`${config.DIMENSIONS.length} 大構面落點概覽`);
    expect(portal.textContent).toContain(`總分 ${config.MIN_SCORE}–${config.MAX_SCORE}`);
    // 落點等級對照表應列出該題庫自己的 4 個等級
    config.LEVELS.forEach((l) => {
      const label = l.badge.slice(l.badge.indexOf(' ') + 1);
      expect(portal.textContent).toContain(label);
    });
  });

  it('L9D 領導力評量仍顯示自己的名稱、構面數與分數區間', () => {
    const { config } = renderFor('leadership-9d');

    expect(portal.textContent).toContain(config.NAME);
    expect(portal.textContent).toContain(`${config.DIMENSIONS.length} 大構面落點概覽`);
    expect(portal.textContent).toContain(`總分 ${config.MIN_SCORE}–${config.MAX_SCORE}`);
    config.LEVELS.forEach((l) => {
      const label = l.badge.slice(l.badge.indexOf(' ') + 1);
      expect(portal.textContent).toContain(label);
    });
  });

  it('沒有子能力的題庫不顯示子能力說明', () => {
    renderFor('ai-competency');
    expect(portal.textContent).not.toContain('子能力分析');
  });

  it('有子能力的題庫顯示子能力說明', () => {
    renderFor('leadership-9d');
    expect(portal.textContent).toContain('子能力分析');
  });

  it('工具列顯示評量名稱', () => {
    const { config } = renderFor('ai-competency');
    // 評量名稱在工具列與封面各出現一次，兩處都應是該題庫自己的名稱。
    expect(screen.getAllByText(config.NAME).length).toBeGreaterThan(0);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserDashboard from '../survey/dashboard/UserDashboard';
import { ConfirmProvider } from '../survey/components/ConfirmDialog';
import { getAssessment } from '../survey/data/assessments/index.js';
import { buildResult } from '../survey/utils/scoring';

// PROFILE_MODE 題庫（DISC）沒有「進步／退步」這種事，「我的分析」頁必須用
// 中性的「風格變化」呈現，而不是像一般題庫那樣顯示總分增益／總分趨勢圖。
// 這裡直接用真正的計分引擎（buildResult）產生兩筆風格明顯不同的作答結果，
// 而不是手刻假資料，確保測試不會跟 disc.js 的實際內容脫節。

const discConfig = getAssessment('disc');

function answersFavoring(dimId) {
  const answers = {};
  discConfig.DIMENSIONS.forEach((d) => {
    d.questions.forEach((q) => {
      answers[q.id] = d.id === dimId ? 5 : 1;
    });
  });
  return answers;
}

const preResult = buildResult(answersFavoring('dominance'), discConfig);
const postResult = buildResult(answersFavoring('steadiness'), discConfig);

const subs = [
  { id: 's2', assessmentId: 'disc', phase: 'post', createdAt: '2026-02-01T00:00:00Z', result: postResult },
  { id: 's1', assessmentId: 'disc', phase: 'pre', createdAt: '2026-01-01T00:00:00Z', result: preResult },
];

vi.mock('../survey/api/client', () => ({
  api: {
    mySubmissions: async () => subs,
    myGroups: async () => [],
    benchmark: async () => null,
    myGoals: async () => [],
    createGoal: async (body) => ({ id: 'g1', actions: [], achievedAt: null, createdAt: new Date().toISOString(), ...body }),
    updateGoal: async (id, body) => ({ id, actions: [], achievedAt: null, createdAt: new Date().toISOString(), ...body }),
    deleteGoal: async () => ({ ok: true }),
    learningResources: async () => [],
  },
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <ConfirmProvider>
        <UserDashboard user={{ id: 'u1', name: '小明' }} onTakeSurvey={() => {}} />
      </ConfirmProvider>
    </MemoryRouter>,
  );
}

describe('UserDashboard × PROFILE_MODE 題庫（DISC）', () => {
  it('顯示「風格變化」而不是「學習增益」或「歷次總分趨勢」', async () => {
    renderDashboard();
    expect(await screen.findByText('風格變化')).toBeInTheDocument();
    expect(screen.queryByText('學習增益')).not.toBeInTheDocument();
    expect(screen.queryByText('歷次總分趨勢')).not.toBeInTheDocument();
    // 兩次作答真正算出來的風格徽章都應該出現在畫面上。
    expect(screen.getAllByText(preResult.level.badge).length).toBeGreaterThan(0);
    expect(screen.getAllByText(postResult.level.badge).length).toBeGreaterThan(0);
  });

  it('構面表格標題改為「構面位移追蹤」，變化用中性符號呈現、不用紅綠色', async () => {
    renderDashboard();
    expect(await screen.findByText('構面位移追蹤')).toBeInTheDocument();
    expect(screen.queryByText('構面進步追蹤')).not.toBeInTheDocument();
    // 中性符號 ← 而非帶有價值判斷的 ↑/↓。
    expect(document.body.textContent).toContain('←');
    expect(document.body.textContent).not.toMatch(/[↑↓]/);
  });
});

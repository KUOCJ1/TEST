import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SurveyApp from '../survey/SurveyApp';
import { ALL_QUESTIONS } from '../survey/data/questions';
import { ConfirmProvider } from '../survey/components/ConfirmDialog';

// 模擬後端 API：送出評測只需驗證有正確呼叫。myGroups/mySubmissions 回空陣列，
// 代表這裡的受測者不屬於任何班別，維持課前/課後手動切換（見 SurveyApp 的 S-04 判定）。
const { createSubmission } = vi.hoisted(() => ({ createSubmission: vi.fn() }));
vi.mock('../survey/api/client', () => ({
  api: {
    createSubmission,
    myGroups: async () => [],
    mySubmissions: async () => [],
    learningResources: async () => [],
  },
}));

beforeEach(() => {
  localStorage.clear();
  createSubmission.mockReset();
  createSubmission.mockResolvedValue({ id: 's1' });
});

// SurveyApp 送出後改用 useNavigate() 導頁（見 handleContinue），需要 Router context。
function renderSurvey(props) {
  return render(
    <MemoryRouter>
      <ConfirmProvider>
        <SurveyApp {...props} />
      </ConfirmProvider>
    </MemoryRouter>,
  );
}

// 為每一題選取指定分數。
function answerAll(value) {
  ALL_QUESTIONS.forEach((q) => {
    const radios = document.querySelectorAll(`input[name="${q.id}"]`);
    fireEvent.click(radios[value - 1]);
  });
}

describe('SurveyApp', () => {
  it('渲染標題與全部 37 題', () => {
    renderSurvey();
    expect(screen.getByText('AI 全方位職能實戰課前評測')).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(37 * 5);
  });

  it('未答完即送出會顯示提示且不出現結果', () => {
    renderSurvey();
    fireEvent.click(screen.getByRole('button', { name: /送出評測/ }));
    expect(screen.getByText(/尚未作答，已為您標示/)).toBeInTheDocument();
    expect(screen.queryByText(/您的總得分/)).not.toBeInTheDocument();
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it('全部填滿後送出，顯示總分與落點等級', async () => {
    renderSurvey();
    answerAll(5);
    fireEvent.click(screen.getByRole('button', { name: /送出評測/ }));

    const heading = await screen.findByText(/您的總得分/);
    const result = heading.closest('section');
    // 全部原始分數填 5：31 正向題 ×5 + 6 反向題 ×1 = 161。
    expect(within(result).getByText('161')).toBeInTheDocument();
    expect(within(result).getByText(/AI 領航核心領袖/)).toBeInTheDocument();
    expect(within(result).getByLabelText('6 大構面能力雷達圖，各構面數值詳見下方表格')).toBeInTheDocument();
  });

  it('進度條隨作答更新', () => {
    renderSurvey();
    expect(screen.getByText(/0 \/ 37 題/)).toBeInTheDocument();
    fireEvent.click(document.querySelectorAll('input[name="q1"]')[2]);
    expect(screen.getByText(/1 \/ 37 題/)).toBeInTheDocument();
  });

  it('作答內容會持久化到 localStorage（依使用者與題庫分開）', () => {
    renderSurvey();
    fireEvent.click(document.querySelectorAll('input[name="q1"]')[3]); // 4 分
    expect(JSON.parse(localStorage.getItem('aiassess_draft_guest_ai-competency_v2')).q1).toBe(4);
  });

  it('送出後會呼叫 API 建立紀錄並回呼 onSubmitted', async () => {
    const onSubmitted = vi.fn();
    renderSurvey({ user: { id: 'u1', name: '小明' }, onSubmitted });
    answerAll(4);
    fireEvent.click(screen.getByRole('button', { name: /送出評測/ }));

    await screen.findByText(/您的總得分/);
    expect(createSubmission).toHaveBeenCalledTimes(1);
    const payload = createSubmission.mock.calls[0][0];
    // 全部原始分數填 4：31 正向題 ×4 + 6 反向題 ×2 = 136。
    expect(payload.result.total).toBe(136);
    expect(payload.phase).toBe('pre');
    expect(onSubmitted).toHaveBeenCalledWith(expect.objectContaining({ total: 136 }));
  });

  it('低分情境落到 AI 新手村', async () => {
    renderSurvey();
    answerAll(1);
    fireEvent.click(screen.getByRole('button', { name: /送出評測/ }));
    const result = (await screen.findByText(/您的總得分/)).closest('section');
    // 全部原始分數填 1：31 正向題 ×1 + 6 反向題 ×5 = 61。
    expect(within(result).getByText('61')).toBeInTheDocument();
    expect(within(result).getByText(/AI 新手村/)).toBeInTheDocument();
  });
});

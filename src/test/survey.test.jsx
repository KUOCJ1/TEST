import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SurveyApp from '../survey/SurveyApp';
import { ALL_QUESTIONS } from '../survey/data/questions';
import { getAssessment } from '../survey/data/assessments/index.js';
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

  it('作答頁不會顯示反向計分題的標示（避免受測者識別並規避效度檢核）', () => {
    renderSurvey();
    expect(screen.queryByTitle(/反向計分/)).not.toBeInTheDocument();
    expect(screen.queryByText(/標示題目為反向計分/)).not.toBeInTheDocument();
  });

  it('題目聚焦時按數字鍵可直接選分並自動跳到下一題', () => {
    renderSurvey();
    const q1FirstRadio = document.querySelectorAll('input[name="q1"]')[0];
    fireEvent.keyDown(q1FirstRadio, { key: '4' });
    // 4 分是第 4 個選項（index 3）。
    expect(document.querySelectorAll('input[name="q1"]')[3]).toBeChecked();
    const q2FirstRadio = document.querySelectorAll('input[name="q2"]')[0];
    expect(document.activeElement).toBe(q2FirstRadio);
  });

  it('360° 他評頁：題庫未設定 RATER_PROMPT 時使用中性預設文字', () => {
    renderSurvey({ raterType: 'peer', rateeName: '王小明' });
    expect(screen.getByText('您正在評估「王小明」')).toBeInTheDocument();
    expect(screen.getByText('的日常行為表現')).toBeInTheDocument();
  });

  it('360° 他評頁：DISC 使用自己客製的提示文字', () => {
    renderSurvey({ assessmentId: 'disc', raterType: 'peer', rateeName: '王小明' });
    expect(screen.getByText('您正在評估「王小明」')).toBeInTheDocument();
    expect(screen.getByText('在工作中展現的行為風格')).toBeInTheDocument();
    expect(screen.queryByText('的日常行為表現')).not.toBeInTheDocument();
  });
});

describe('SurveyApp（L9D 長問卷分頁作答）', () => {
  const l9d = getAssessment('leadership-9d');

  function answerDimension(dim, value) {
    dim.questions.forEach((q) => {
      const radios = document.querySelectorAll(`input[name="${q.id}"]`);
      fireEvent.click(radios[value - 1]);
    });
  }

  it('90 題以 9 個構面分頁顯示，一次只渲染一段', () => {
    renderSurvey({ assessmentId: 'leadership-9d' });
    expect(screen.getByText(/第 1 \/ 9 段/)).toBeInTheDocument();
    // 每段 10 題 × 5 個選項 = 50 個 radio；不是一次全部 90 題的 450 個。
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(50);
    // 整體進度條仍以全部 90 題計算，不受分頁影響。
    expect(screen.getByText(/0 \/ 90 題/)).toBeInTheDocument();
  });

  it('「下一段」可切到下一個構面，「上一段」在第一頁停用', () => {
    renderSurvey({ assessmentId: 'leadership-9d' });
    expect(screen.getByRole('button', { name: /上一段/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /下一段/ }));
    expect(screen.getByText(/第 2 \/ 9 段/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /上一段/ })).not.toBeDisabled();
  });

  it('可直接點分頁圓點跳到任一段', () => {
    renderSurvey({ assessmentId: 'leadership-9d' });
    fireEvent.click(screen.getByRole('button', { name: /第 5 段/ }));
    expect(screen.getByText(/第 5 \/ 9 段/)).toBeInTheDocument();
    expect(document.querySelectorAll(`input[name="${l9d.DIMENSIONS[4].questions[0].id}"]`).length).toBe(5);
  });

  it('最後一段送出時若前面仍有未答題，會自動跳回第一個缺漏所在的分頁並標示', () => {
    renderSurvey({ assessmentId: 'leadership-9d' });
    // 跳到最後一段（第 9 段）並全部答完，但前面 8 段都還沒作答。
    fireEvent.click(screen.getByRole('button', { name: /第 9 段/ }));
    answerDimension(l9d.DIMENSIONS[8], 3);
    fireEvent.click(screen.getByRole('button', { name: /送出評測/ }));

    expect(screen.getByText(/還有 \d+ 題尚未作答/)).toBeInTheDocument();
    // 第一個缺漏在第 1 段（communication），應自動跳回去。
    expect(screen.getByText(/第 1 \/ 9 段/)).toBeInTheDocument();
  });

  it('九段全部答完才會真正送出', async () => {
    const onSubmitted = vi.fn();
    renderSurvey({ assessmentId: 'leadership-9d', user: { id: 'u1', name: '小明' }, onSubmitted });
    l9d.DIMENSIONS.forEach((dim, i) => {
      answerDimension(dim, 4);
      if (i < l9d.DIMENSIONS.length - 1) {
        fireEvent.click(screen.getByRole('button', { name: /下一段/ }));
      }
    });
    fireEvent.click(screen.getByRole('button', { name: /送出評測/ }));

    await screen.findByText(/您的總得分/);
    expect(createSubmission).toHaveBeenCalledTimes(1);
  });

  it('最後一段的送出按鈕是 type="button"，不是原生 type="submit"', () => {
    // 迴歸測試：分頁模式下「下一段」跟「送出評測」共用同一個 DOM 位置，只有 type
    // 不同。若改回 type="submit"，點「下一段」切到最後一段的那一下，React 會在同一次
    // 點擊事件內把這顆按鈕的 type 同步從 button 換成 submit，瀏覽器判定表單送出用的是
    // 「事件處理當下」的 type，實測（真實瀏覽器）會讓那一下點擊誤觸原生表單送出、用
    // 還沒切過去的舊 answers 送出——jsdom 不會重現這個瀏覽器原生行為的時序競態，所以
    // 只能用這個結構性斷言把修法釘住：最後一段的送出鈕必須維持 type="button"，靠
    // onClick 直接呼叫 handleSubmit，完全不依賴表單原生 submit。
    renderSurvey({ assessmentId: 'leadership-9d' });
    fireEvent.click(screen.getByRole('button', { name: /第 9 段/ }));
    const submitBtn = screen.getByRole('button', { name: /送出評測/ });
    expect(submitBtn).toHaveAttribute('type', 'button');
  });
});

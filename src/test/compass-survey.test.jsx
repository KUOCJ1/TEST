import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SurveyApp from '../survey/SurveyApp';
import { ConfirmProvider } from '../survey/components/ConfirmDialog';

const { createSubmission } = vi.hoisted(() => ({ createSubmission: vi.fn() }));
vi.mock('../survey/api/client', () => ({
  api: {
    createSubmission,
    myGroups: async () => [],
    mySubmissions: async () => [],
    learningResources: async () => [],
    myReadingList: async () => [],
    addToReadingList: async () => ({}),
    trackArticleClick: async () => {},
    myGoals: async () => [],
  },
}));

beforeEach(() => {
  localStorage.clear();
  createSubmission.mockReset();
  createSubmission.mockResolvedValue({ id: 's1' });
});

function renderSurvey(props) {
  return render(
    <MemoryRouter>
      <ConfirmProvider>
        <SurveyApp assessmentId="leadership-compass" user={{ id: 'u1', name: '測試' }} {...props} />
      </ConfirmProvider>
    </MemoryRouter>,
  );
}

// 目前這一頁（一個構面）的所有題目都選同一個分數。
function answerPage(value = 4) {
  document.querySelectorAll('fieldset[data-question-id]').forEach((fs) => {
    const radios = fs.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[value - 1]);
  });
}

describe('領導力羅盤：作答頁', () => {
  it('預設精簡版：共 32 題，分 8 段，第一段只顯示 4 題與頻率量表', () => {
    renderSurvey();
    expect(screen.getByText('領導力羅盤八向評測')).toBeInTheDocument();
    expect(screen.getByText('32 題')).toBeInTheDocument();
    expect(screen.getByText('8 段')).toBeInTheDocument();
    expect(document.querySelectorAll('fieldset[data-question-id]')).toHaveLength(4);
    expect(screen.getByText(/1 分（從不）～ 5 分（總是）/)).toBeInTheDocument();
    expect(screen.getAllByText(/不是能力高低/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('洞察情勢', { exact: false }).length).toBeGreaterThan(0);
  });

  it('可切換完整版：69 題', () => {
    renderSurvey();
    fireEvent.click(screen.getByRole('button', { name: '完整版' }));
    expect(screen.getByText('69 題')).toBeInTheDocument();
    // 完整版第一段（洞察情勢）有 8 題
    expect(document.querySelectorAll('fieldset[data-question-id]')).toHaveLength(8);
  });

  it('自評版不提供「無法判斷」', () => {
    renderSurvey();
    fireEvent.click(screen.getByRole('button', { name: '完整版' }));
    expect(screen.queryByText('無法判斷')).not.toBeInTheDocument();
  });

  it('他評版：顯示第三人稱題目，低可觀察題才有「無法判斷」', () => {
    renderSurvey({ raterType: 'peer', rateeId: 'r1', rateeName: '王主管' });
    fireEvent.click(screen.getByRole('button', { name: '完整版' }));
    expect(screen.getAllByText(/這位主管/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/我會/)).not.toBeInTheDocument();
    // 洞察情勢完整版含 4 題低可觀察（find-2、find-11、find-14，另 1 題視題庫）
    expect(screen.getAllByText('無法判斷').length).toBeGreaterThan(0);
  });

  it('精簡版逐段填完後送出，結果含版本、八構面與張力', async () => {
    renderSurvey();
    for (let i = 0; i < 8; i += 1) {
      answerPage(4);
      if (i < 7) fireEvent.click(screen.getByRole('button', { name: /下一段/ }));
    }
    fireEvent.click(screen.getByRole('button', { name: /送出評測/ }));
    await waitFor(() => expect(createSubmission).toHaveBeenCalledTimes(1));
    const payload = createSubmission.mock.calls[0][0];
    expect(payload.assessmentId).toBe('leadership-compass');
    expect(payload.raterType).toBe('self');
    expect(payload.result.form).toBe('short');
    expect(payload.result.dimensions).toHaveLength(8);
    expect(payload.result.tensions).toHaveLength(4);
    expect(payload.result.itemVersion).toBe('compass-0.3');
    expect(Object.keys(payload.answers)).toHaveLength(32);
  });

  it('未答完送出會提示且不呼叫 API', () => {
    renderSurvey();
    fireEvent.click(screen.getByRole('button', { name: /下一段/ }));
    for (let i = 0; i < 6; i += 1) fireEvent.click(screen.getByRole('button', { name: /下一段/ }));
    fireEvent.click(screen.getByRole('button', { name: /送出評測/ }));
    expect(createSubmission).not.toHaveBeenCalled();
  });
});

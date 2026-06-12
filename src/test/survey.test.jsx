import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import SurveyApp from '../survey/SurveyApp';
import { ALL_QUESTIONS } from '../survey/data/questions';

beforeEach(() => {
  localStorage.clear();
});

// 為每一題選取指定分數。
function answerAll(value) {
  ALL_QUESTIONS.forEach((q) => {
    const radios = document.querySelectorAll(`input[name="${q.id}"]`);
    const target = radios[value - 1];
    fireEvent.click(target);
  });
}

describe('SurveyApp', () => {
  it('渲染標題與全部 31 題', () => {
    render(<SurveyApp />);
    expect(screen.getByText('AI 全方位職能實戰課前評測')).toBeInTheDocument();
    // 每題 5 個選項 → 31 × 5 個 radio。
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(31 * 5);
  });

  it('未答完即送出會顯示提示且不出現結果', () => {
    render(<SurveyApp />);
    fireEvent.click(screen.getByRole('button', { name: /送出評測/ }));
    expect(screen.getByText(/尚未作答，已為您標示/)).toBeInTheDocument();
    expect(screen.queryByText(/您的 AI 職能總得分/)).not.toBeInTheDocument();
  });

  it('全部填滿後送出，顯示總分與落點等級', () => {
    render(<SurveyApp />);
    answerAll(5);
    fireEvent.click(screen.getByRole('button', { name: /送出評測/ }));

    const result = screen.getByText(/您的 AI 職能總得分/).closest('section');
    expect(result).toBeInTheDocument();
    // 全 5 分 → 155 分、AI 領航核心領袖。
    expect(within(result).getByText('155')).toBeInTheDocument();
    expect(within(result).getByText(/AI 領航核心領袖/)).toBeInTheDocument();
    expect(within(result).getByLabelText('六大構面能力雷達圖')).toBeInTheDocument();
  });

  it('進度條隨作答更新', () => {
    render(<SurveyApp />);
    expect(screen.getByText(/0 \/ 31 題/)).toBeInTheDocument();
    const radios = document.querySelectorAll(`input[name="q1"]`);
    fireEvent.click(radios[2]);
    expect(screen.getByText(/1 \/ 31 題/)).toBeInTheDocument();
  });

  it('作答內容會持久化到 localStorage', () => {
    render(<SurveyApp />);
    const radios = document.querySelectorAll(`input[name="q1"]`);
    fireEvent.click(radios[3]); // 4 分
    const stored = JSON.parse(localStorage.getItem('ai-assessment-answers-v1'));
    expect(stored.q1).toBe(4);
  });

  it('低分情境落到 AI 新手村', () => {
    render(<SurveyApp />);
    answerAll(1);
    fireEvent.click(screen.getByRole('button', { name: /送出評測/ }));
    const result = screen.getByText(/您的 AI 職能總得分/).closest('section');
    expect(within(result).getByText('31')).toBeInTheDocument();
    expect(within(result).getByText(/AI 新手村/)).toBeInTheDocument();
  });
});

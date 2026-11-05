import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FollowUpBanner from '../survey/course/FollowUpBanner.jsx';
import { FOLLOW_UP } from '../survey/data/course-follow-up.js';
import { api } from '../survey/api/client';
// 伺服器的欄位白名單與前端題目必須一致（改題目要兩邊一起改）。
import { FOLLOW_UP_QUESTIONS } from '../../server/src/lib/courseFollowUpQuestions.js';

describe('前後端追蹤問卷題目一致', () => {
  it.each([30, 60])('%i 天：題目 id、型別、必填與選項完全相同', (stage) => {
    const client = FOLLOW_UP[stage].questions;
    const server = FOLLOW_UP_QUESTIONS[stage];
    expect(client.map((q) => q.id)).toEqual(server.map((q) => q.id));
    server.forEach((sq, i) => {
      const cq = client[i];
      expect(cq.type, sq.id).toBe(sq.type);
      expect(Boolean(cq.required), sq.id).toBe(Boolean(sq.required));
      if (sq.options) expect(cq.options.map((o) => o.id), sq.id).toEqual(sq.options);
      if (sq.max) expect(cq.max, sq.id).toBe(sq.max);
    });
  });
});

describe('FollowUpBanner', () => {
  beforeEach(() => { vi.restoreAllMocks(); window.history.pushState({}, '', '/'); });
  afterEach(() => { window.history.pushState({}, '', '/'); });

  it('沒有到期的追蹤問卷、或取不到資料：什麼都不顯示', async () => {
    vi.spyOn(api, 'getMyFollowUps').mockResolvedValue({ items: [{ stage: 30, status: 'not_due' }] });
    const { container } = render(<FollowUpBanner />);
    await waitFor(() => expect(api.getMyFollowUps).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
  it('API 失敗也不顯示錯誤、不影響首頁', async () => {
    vi.spyOn(api, 'getMyFollowUps').mockRejectedValue(new Error('x'));
    const { container } = render(<FollowUpBanner />);
    await waitFor(() => expect(api.getMyFollowUps).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
  it('30 天已開放：顯示提示；按「現在填寫」→ 填必填題 → 送出成功', async () => {
    vi.spyOn(api, 'getMyFollowUps').mockResolvedValue({ items: [{ stage: 30, status: 'available' }, { stage: 60, status: 'not_due' }] });
    const submit = vi.spyOn(api, 'submitFollowUp').mockResolvedValue({ ok: true });
    render(<FollowUpBanner />);
    fireEvent.click(await screen.findByRole('button', { name: '現在填寫' }));
    fireEvent.click(screen.getByRole('button', { name: '送出' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('必填');
    expect(submit).not.toHaveBeenCalled();
    for (const q of FOLLOW_UP[30].questions.filter((x) => x.required)) {
      fireEvent.click(document.querySelector(`input[name="${q.id}"][value="${q.options[0].id}"]`));
    }
    fireEvent.click(screen.getByRole('button', { name: '送出' }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toBe(30);
    expect(submit.mock.calls[0][1].f1).toBe('done');
    expect(await screen.findByText('謝謝您的回覆')).toBeInTheDocument();
    expect(screen.getByText(/60 天後我們會再邀請/)).toBeInTheDocument();
  });
  it('信裡的連結 ?followup=60：登入後自動展開 60 天那份，關閉後不再自動展開', async () => {
    window.history.pushState({}, '', '/?followup=60');
    vi.spyOn(api, 'getMyFollowUps').mockResolvedValue({ items: [{ stage: 30, status: 'completed' }, { stage: 60, status: 'available' }] });
    render(<FollowUpBanner />);
    expect(await screen.findByRole('region', { name: '60 天追蹤問卷' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '稍後再填' }));
    expect(screen.queryByRole('region', { name: '60 天追蹤問卷' })).toBeNull();
    expect(screen.getByRole('button', { name: '現在填寫' })).toBeInTheDocument();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthContext } from '../survey/auth/authContextObject';
import GoalPanel from '../survey/components/GoalPanel';
import PracticePanel from '../survey/components/PracticePanel';
import FirstActionCard from '../survey/components/FirstActionCard';
import QuickGoalButton from '../survey/components/QuickGoalButton';
import TrialLock from '../survey/trial/TrialLock';
import VerifyEmailBanner from '../survey/trial/VerifyEmailBanner';
import LoginPage from '../survey/auth/LoginPage';
import { ConfirmProvider } from '../survey/components/ConfirmDialog';

// 試用帳號（推廣期自行註冊）：360° 與發展功能看得到介紹但不能用；未驗證 Email 時有提醒。

const { api } = vi.hoisted(() => ({
  api: { myGoals: vi.fn(), createGoal: vi.fn(), myPractice: vi.fn(), resendVerifyEmail: vi.fn() },
}));
vi.mock('../survey/api/client', () => ({ api }));

const withUser = (user, ui) => render(
  <AuthContext.Provider value={{ user }}>
    <ConfirmProvider>{ui}</ConfirmProvider>
  </AuthContext.Provider>,
);

const trialUser = { id: 'u1', name: '試用者', email: 'trial@b.co', role: 'user', trial: true, emailVerified: false };
const fullUser = { ...trialUser, trial: false, emailVerified: true };

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.myGoals.mockResolvedValue([]);
  api.myPractice.mockResolvedValue(null);
});

describe('試用帳號的鎖定畫面', () => {
  it('發展目標與微練習：只顯示功能介紹與開通方式，不打 API、沒有建立按鈕', () => {
    withUser(trialUser, <><GoalPanel assessmentId="ai-competency" /><PracticePanel /></>);
    expect(screen.getByRole('region', { name: /發展目標（試用帳號未開放）/ })).toBeInTheDocument();
    expect(screen.getByRole('note', { name: /四週微練習（試用帳號未開放）/ })).toBeInTheDocument();
    expect(screen.getAllByText(/加入班級後，就能使用完整功能/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /新增目標/ })).toBeNull();
    expect(api.myGoals).not.toHaveBeenCalled();
    expect(api.myPractice).not.toHaveBeenCalled();
  });

  it('結果頁「選一件事」與「訂成目標」按鈕：鎖定', () => {
    withUser(trialUser, <><FirstActionCard result={{ assessmentId: 'ai-competency', dimensions: [] }} /><QuickGoalButton assessmentId="ai-competency" text="x" /></>);
    expect(screen.getByRole('note', { name: /發展目標與四週微練習（試用帳號未開放）/ })).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /訂成目標（完整版）/ });
    expect(btn).toBeDisabled();
  });

  it('結果頁的微練習邀請（offerFrom）：試用時不另外出現，只留合併後的一張說明卡', () => {
    const { container } = withUser(trialUser, <PracticePanel offerFrom={{ assessmentId: 'ai-competency', dimension: { id: 'x', name: 'x' } }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('一般學員：照原本的功能顯示', async () => {
    withUser(fullUser, <GoalPanel assessmentId="ai-competency" />);
    expect(await screen.findByRole('button', { name: /新增目標/ })).toBeInTheDocument();
    expect(screen.queryByText(/試用帳號未開放/)).toBeNull();
  });

  it('360° 的鎖定說明', () => {
    render(<TrialLock feature="360" />);
    expect(screen.getByRole('heading', { name: '360° 多元評測' })).toBeInTheDocument();
  });
});

describe('Email 驗證提醒', () => {
  it('試用且未驗證：顯示提醒，可重寄驗證信', async () => {
    api.resendVerifyEmail.mockResolvedValue({ ok: true });
    withUser(trialUser, <VerifyEmailBanner />);
    expect(screen.getByText(/點驗證連結/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重寄驗證信' }));
    expect(await screen.findByRole('button', { name: '已寄出' })).toBeDisabled();
    expect(api.resendVerifyEmail).toHaveBeenCalledTimes(1);
  });

  it('寄送失敗：顯示原因，可以再試', async () => {
    api.resendVerifyEmail.mockRejectedValue(new Error('驗證信剛寄出，請稍候一分鐘再試'));
    withUser(trialUser, <VerifyEmailBanner />);
    fireEvent.click(screen.getByRole('button', { name: '重寄驗證信' }));
    expect(await screen.findByText(/請稍候一分鐘再試/)).toBeInTheDocument();
  });

  it('已驗證或不是試用帳號：不顯示', () => {
    const { container } = withUser({ ...trialUser, emailVerified: true }, <VerifyEmailBanner />);
    expect(container).toBeEmptyDOMElement();
    const r2 = withUser({ ...fullUser, emailVerified: false }, <VerifyEmailBanner />);
    expect(r2.container).toBeEmptyDOMElement();
  });
});

describe('推廣連結 /start', () => {
  it('直接打開註冊畫面，說明試用可用的評量', () => {
    render(
      <AuthContext.Provider value={{ user: null, login: vi.fn(), register: vi.fn() }}>
        <LoginPage trialStart />
      </AuthContext.Provider>,
    );
    expect(screen.getByText('免費試用')).toBeInTheDocument();
    expect(screen.getByText(/AI 職能評測、DISC 行為風格評測/)).toBeInTheDocument();
    // 註冊模式才有姓名欄位
    expect(screen.getByLabelText(/姓名/)).toBeInTheDocument();
  });
});

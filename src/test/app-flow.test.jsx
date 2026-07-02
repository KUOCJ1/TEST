import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';

// 以記憶體假後端取代真實 API client，模擬註冊/登入/作答/後台流程。
const h = vi.hoisted(() => ({
  state: { user: null, users: [], submissions: [] },
}));

vi.mock('../survey/api/client', () => {
  const { state } = h;
  const pub = (u) => u && { id: u.id, name: u.name, email: u.email, role: u.role };
  return {
    api: {
      async register({ name, email, password }) {
        if (!name?.trim()) throw new Error('請輸入姓名');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((email || '').toLowerCase())) throw new Error('Email 格式不正確');
        if ((password || '').length < 6) throw new Error('密碼至少需 6 碼');
        const e = email.toLowerCase();
        if (state.users.some((u) => u.email === e)) throw new Error('此 Email 已被註冊');
        const u = { id: `u${state.users.length + 1}`, name: name.trim(), email: e, role: 'user' };
        state.users.push(u);
        state.user = u;
        return pub(u);
      },
      async login({ email }) {
        const u = state.users.find((x) => x.email === (email || '').toLowerCase());
        if (!u) throw new Error('Email 或密碼錯誤');
        state.user = u;
        return pub(u);
      },
      async logout() {
        state.user = null;
      },
      async me() {
        if (!state.user) throw new Error('尚未登入');
        return pub(state.user);
      },
      async assessments() {
        return [
          { id: 'ai-competency', name: 'AI 全方位職能實戰課前評測', description: '6 大構面、37 題李克特量表（含反向題）', enabled: true },
        ];
      },
      async adminAssessments() {
        return [
          { id: 'ai-competency', name: 'AI 全方位職能實戰課前評測', description: '6 大構面、37 題李克特量表（含反向題）', enabled: true },
        ];
      },
      async createSubmission({ result, assessmentId }) {
        const s = {
          id: `s${state.submissions.length + 1}`,
          userId: state.user.id,
          userName: state.user.name,
          createdAt: new Date(Date.now() + state.submissions.length).toISOString(),
          assessmentId: assessmentId ?? 'ai-competency',
          result,
        };
        state.submissions.push(s);
        return s;
      },
      async mySubmissions() {
        return state.submissions
          .filter((s) => s.userId === state.user.id)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      },
      async adminOverview() {
        return {
          users: state.users.map(pub),
          submissions: state.submissions.map((s) => ({
            id: s.id,
            userId: s.userId,
            userName: s.userName,
            createdAt: s.createdAt,
            assessmentId: s.assessmentId ?? 'ai-competency',
            result: s.result,
          })),
        };
      },
      async myGroups() { return []; },
      async benchmark(assessmentId) {
        const totals = state.submissions
          .filter((s) => (s.assessmentId ?? 'ai-competency') === assessmentId)
          .map((s) => s.result.total)
          .sort((a, b) => a - b);
        return { assessmentId, count: totals.length, avgTotal: 0, totals, dimensionAverages: [] };
      },
      async coachOverview() { return { users: state.users.map(pub), submissions: [] }; },
      async coachGroups() { return []; },
    },
  };
});

beforeEach(() => {
  h.state.user = null;
  h.state.users = [{ id: 'admin', name: '系統管理員', email: 'admin@demo.tw', role: 'admin' }];
  h.state.submissions = [];
});

function fillLogin(email, password) {
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('至少 6 碼'), { target: { value: password } });
}

async function navigateToLogin() {
  const btns = await screen.findAllByRole('button', { name: '登入平台' });
  fireEvent.click(btns[0]);
}

async function registerUser(name, email, password) {
  fireEvent.click(screen.getByRole('button', { name: '註冊' }));
  fireEvent.change(screen.getByPlaceholderText('您的姓名'), { target: { value: name } });
  fillLogin(email, password);
  fireEvent.click(screen.getByRole('button', { name: /建立帳號/ }));
}

describe('App 流程', () => {
  it('未登入時顯示登入頁', async () => {
    render(<App />);
    await navigateToLogin();
    expect(await screen.findByRole('button', { name: '登入帳號' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  it('註冊後進入評測，且一般使用者看不到管理後台', async () => {
    render(<App />);
    await navigateToLogin();
    await registerUser('小明', 'ming@example.com', 'abcdef');

    // After registration, AssessmentHome loads — click to start the survey.
    fireEvent.click(await screen.findByRole('button', { name: '開始作答' }));

    expect(await screen.findByRole('button', { name: /送出評測/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '管理後台' })).not.toBeInTheDocument();

    // 返回首頁後點「我的分析」確認無紀錄訊息。
    fireEvent.click(screen.getByRole('button', { name: '返回評量列表' }));
    fireEvent.click(await screen.findByRole('button', { name: '我的分析' }));
    expect(await screen.findByText('尚無評測紀錄')).toBeInTheDocument();
  });

  it('管理員登入後可見管理後台儀表板', async () => {
    render(<App />);
    await navigateToLogin();
    fillLogin('admin@demo.tw', 'admin1234');
    fireEvent.click(screen.getByRole('button', { name: '登入帳號' }));

    const adminTab = await screen.findByRole('button', { name: '管理後台' });
    fireEvent.click(adminTab);
    expect(await screen.findByText(/資料分析儀表板/)).toBeInTheDocument();
    expect(screen.getByText('註冊人數')).toBeInTheDocument();
  });

  it('完成評測後我的分析顯示總分與雷達圖', async () => {
    render(<App />);
    await navigateToLogin();
    await registerUser('小美', 'mei@example.com', 'abcdef');

    // Start survey from AssessmentHome.
    fireEvent.click(await screen.findByRole('button', { name: '開始作答' }));
    await screen.findByRole('button', { name: /送出評測/ });

    document.querySelectorAll('fieldset[data-question-id]').forEach((fs) => {
      const radios = fs.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[radios.length - 1]); // 5 分
    });
    fireEvent.click(screen.getByRole('button', { name: /送出評測/ }));

    // After submission, app returns to home; navigate to analysis tab.
    fireEvent.click(await screen.findByRole('button', { name: '我的分析' }));

    expect(await screen.findByText('我的能力分析')).toBeInTheDocument();
    const region = (await screen.findByText(/您的總得分/)).closest('section');
    // 每題選最後一個選項（5 分）：31 正向題 ×5 + 6 反向題 ×1 = 161。
    expect(within(region).getByText('161')).toBeInTheDocument();
    expect(within(region).getByLabelText('6 大構面能力雷達圖')).toBeInTheDocument();
  });
});

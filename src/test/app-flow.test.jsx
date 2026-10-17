import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { POLICY_VERSION } from '../survey/legal/policy';

function renderApp(initialPath = '/') {
  return render(<MemoryRouter initialEntries={[initialPath]}><App /></MemoryRouter>);
}

// 以記憶體假後端取代真實 API client，模擬註冊/登入/作答/後台流程。
const h = vi.hoisted(() => ({
  state: { user: null, users: [], submissions: [] },
  consentVersion: null,
}));
h.consentVersion = POLICY_VERSION;

vi.mock('../survey/api/client', () => {
  const { state } = h;
  const pub = (u) => u && { id: u.id, name: u.name, email: u.email, role: u.role, consent: u.consent ?? null };
  return {
    api: {
      async register({ name, email, password, acceptPolicy }) {
        if (!name?.trim()) throw new Error('請輸入姓名');
        if (acceptPolicy !== true) throw new Error('請先閱讀並同意隱私權政策與服務條款');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((email || '').toLowerCase())) throw new Error('Email 格式不正確');
        if ((password || '').length < 8) throw new Error('密碼至少需 8 碼');
        const e = email.toLowerCase();
        if (state.users.some((u) => u.email === e)) throw new Error('此 Email 已被註冊');
        const u = { id: `u${state.users.length + 1}`, name: name.trim(), email: e, role: 'user', consent: { version: h.consentVersion, acceptedAt: new Date().toISOString() } };
        state.users.push(u);
        state.user = u;
        return { user: pub(u), joinedGroup: null };
      },
      async login({ email }) {
        const u = state.users.find((x) => x.email === (email || '').toLowerCase());
        if (!u) throw new Error('Email 或密碼錯誤');
        state.user = u;
        return { user: pub(u), joinedGroup: null };
      },
      async logout() {
        state.user = null;
      },
      async acceptPolicy() {
        state.user.consent = { version: h.consentVersion, acceptedAt: new Date().toISOString() };
        return pub(state.user);
      },
      async me() {
        if (!state.user) throw new Error('尚未登入');
        return pub(state.user);
      },
      async session() {
        return state.user ? pub(state.user) : null;
      },
      async learningResources() {
        return [];
      },
      async myReadingList() { return []; },
      async addToReadingList(body) { return { id: 'r1', read: false, addedAt: new Date().toISOString(), ...body }; },
      async trackArticleClick() {},
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
      async adminLearningResourceStats() { return []; },
      async health() { return { ok: true, version: { commit: null, builtAt: null } }; },
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
      // 首頁「下一步」卡片與 360° 頁都需要這支；這支流程測試不驗證這些功能，
      // 給空清單讓對應元件正常渲染即可。
      async groupMembers() { return []; },
      // 個人發展目標：這支流程測試不驗證目標功能，給空清單讓 GoalPanel 正常渲染即可。
      async myGoals() { return []; },
      async createGoal(body) { return { id: 'g1', actions: [], achievedAt: null, createdAt: new Date().toISOString(), ...body }; },
      async updateGoal(id, body) { return { id, actions: [], achievedAt: null, createdAt: new Date().toISOString(), ...body }; },
      async deleteGoal() { return { ok: true }; },
      async benchmark(assessmentId) {
        const totals = state.submissions
          .filter((s) => (s.assessmentId ?? 'ai-competency') === assessmentId)
          .map((s) => s.result.total)
          .sort((a, b) => a - b);
        return { assessmentId, count: totals.length, avgTotal: 0, totals, dimensionAverages: [] };
      },
      async coachOverview() { return { users: state.users.map(pub), submissions: [] }; },
      async coachGroups() { return []; },
      async publicJoinInfo() { throw new Error('無此代碼'); },
      async joinGroup() { throw new Error('無此代碼'); },
    },
  };
});

// AppShell／AdminDashboard 是 lazy() 載入的大塊（含全部題庫資料、題庫內容編輯器…）。CI 冷啟動時
// 第一次轉譯整條相依鏈要好幾秒，會把「等畫面出現」的時間吃光而偶發失敗（Sprint 7、8、9、10、12 都遇過）。
// 在所有測試開始前先載入一次：之後 lazy() 拿到的是快取好的模組，測試本身只剩渲染的時間。
beforeAll(async () => {
  await import('../survey/AppShell');
  await import('../survey/admin/AdminDashboard');
}, 60000);

beforeEach(() => {
  h.state.user = null;
  h.state.users = [{ id: 'admin', name: '系統管理員', email: 'admin@demo.tw', role: 'admin', consent: { version: POLICY_VERSION, acceptedAt: '2026-10-17T00:00:00Z' } }];
  h.state.submissions = [];
});

function fillLogin(email, password) {
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('至少 8 碼'), { target: { value: password } });
}

async function navigateToLogin() {
  const btns = await screen.findAllByRole('button', { name: '登入平台' });
  fireEvent.click(btns[0]);
}

async function registerUser(name, email, password) {
  fireEvent.click(screen.getByRole('tab', { name: '註冊' }));
  fireEvent.change(screen.getByPlaceholderText('您的姓名'), { target: { value: name } });
  fillLogin(email, password);
  fireEvent.click(screen.getByRole('checkbox', { name: /隱私權政策/ }));
  fireEvent.click(screen.getByRole('button', { name: /建立帳號/ }));
}

describe('App 流程', () => {
  it('未登入時顯示登入頁', async () => {
    renderApp();
    await navigateToLogin();
    expect(await screen.findByRole('button', { name: '登入帳號' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  it('註冊後進入評測，且一般使用者看不到管理後台', async () => {
    renderApp();
    await navigateToLogin();
    await registerUser('小明', 'ming@example.com', 'abcdef12');

    // After registration, AssessmentHome loads — click to start the survey.
    fireEvent.click(await screen.findByRole('button', { name: '開始作答' }));

    expect(await screen.findByRole('button', { name: /送出評測/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '管理後台' })).not.toBeInTheDocument();

    // 返回首頁後點「我的分析」確認無紀錄訊息。
    fireEvent.click(screen.getByRole('button', { name: '返回評量列表' }));
    // 頂部分頁與手機底部導覽在 jsdom 裡同時存在（CSS 不生效），取第一個。
    fireEvent.click((await screen.findAllByRole('button', { name: '我的分析' }))[0]);
    expect(await screen.findByText('尚無評測紀錄')).toBeInTheDocument();
  });

  it('作答中點左上角的名稱回到「我的評量」；行銷首頁在登入狀態下可以連回「我的評量」', async () => {
    renderApp();
    await navigateToLogin();
    await registerUser('小華', 'hua@example.com', 'abcdef12');
    fireEvent.click(await screen.findByRole('button', { name: '開始作答' }));
    expect(await screen.findByRole('button', { name: /送出評測/ })).toBeInTheDocument();

    const brand = screen.getByRole('link', { name: '回到我的評量' });
    expect(brand).toHaveAttribute('href', '/home');
    fireEvent.click(brand);
    expect(await screen.findByRole('heading', { name: '選擇評量' })).toBeInTheDocument();
  });

  it('已登入看行銷首頁（/welcome）：按鈕是「前往我的評量」，導覽列名稱也連回我的評量', async () => {
    h.state.users.push({ id: 'u9', name: '小美', email: 'mei@demo.tw', role: 'user', consent: { version: POLICY_VERSION, acceptedAt: '2026-10-17T00:00:00Z' } });
    h.state.user = h.state.users.find((u) => u.id === 'u9');
    renderApp('/welcome');
    expect(await screen.findByRole('heading', { level: 1, name: /先看清楚現在/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '立即開始' })).not.toBeInTheDocument();
    const toApp = await screen.findAllByRole('link', { name: '前往我的評量' });
    expect(toApp.length).toBeGreaterThan(1); // 導覽列、首頁主按鈕、頁尾橫幅
    toApp.forEach((l) => expect(l).toHaveAttribute('href', '/home'));
    expect(screen.getAllByRole('link', { name: /全方位職能評測/ })[0]).toHaveAttribute('href', '/home');
  });

  it('沒有同意紀錄的既有用戶登入後先看到同意畫面，同意後才進入首頁', async () => {
    h.state.users.push({ id: 'old', name: '舊學員', email: 'old@demo.tw', role: 'user' });
    renderApp();
    await navigateToLogin();
    fillLogin('old@demo.tw', 'abcdef12');
    fireEvent.click(screen.getByRole('button', { name: '登入帳號' }));
    expect(await screen.findByRole('heading', { name: /請閱讀並同意隱私權政策與服務條款/ })).toBeInTheDocument();
    // 同意之前看不到系統。
    expect(screen.queryByRole('heading', { name: '選擇評量' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '我同意並繼續' }));
    expect(await screen.findByRole('heading', { name: '選擇評量' }, { timeout: 15000 })).toBeInTheDocument();
  });

  it('同意版本落後的用戶也會再被詢問；不同意可以登出回到登入頁', async () => {
    h.state.users.push({ id: 'old', name: '舊學員', email: 'old@demo.tw', role: 'user', consent: { version: '2020-01-01', acceptedAt: '2020-01-01T00:00:00Z' } });
    renderApp();
    await navigateToLogin();
    fillLogin('old@demo.tw', 'abcdef12');
    fireEvent.click(screen.getByRole('button', { name: '登入帳號' }));
    fireEvent.click(await screen.findByRole('button', { name: '不同意，登出' }));
    expect(await screen.findByRole('button', { name: '登入帳號' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '選擇評量' })).not.toBeInTheDocument();
  });

  it('管理員登入後可見管理後台儀表板', async () => {
    renderApp();
    await navigateToLogin();
    fillLogin('admin@demo.tw', 'admin1234');
    fireEvent.click(screen.getByRole('button', { name: '登入帳號' }));

    const adminTab = (await screen.findAllByRole('button', { name: '管理後台' }))[0];
    fireEvent.click(adminTab);
    // AdminDashboard 是 lazy() 載入的獨立 chunk：CI 的冷啟動要先編譯整條相依鏈，
    // 超過 findBy 預設的 1 秒是常態（Sprint 7 在 CI 上因此失敗過一次），給足時間。
    expect(await screen.findByRole('heading', { name: '管理後台' }, { timeout: 15000 })).toBeInTheDocument();
    expect(screen.getByText('註冊人數')).toBeInTheDocument();
  });

  it('管理後台分頁依用途命名並附說明：班級分析／各評量統計；切換後說明跟著換', async () => {
    renderApp();
    await navigateToLogin();
    fillLogin('admin@demo.tw', 'admin1234');
    fireEvent.click(screen.getByRole('button', { name: '登入帳號' }));
    fireEvent.click((await screen.findAllByRole('button', { name: '管理後台' }))[0]);
    expect(await screen.findByRole('heading', { name: '管理後台' }, { timeout: 15000 })).toBeInTheDocument();
    ['班級分析', '各評量統計', '用戶管理', '班別與發佈', '題庫內容', '批次上傳', '系統狀態'].forEach((n) => expect(screen.getByRole('button', { name: n })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: '快速分析' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '數據分析' })).not.toBeInTheDocument();
    expect(screen.getByText(/選一份評量，看所有填答者的整體分佈/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '班級分析' }));
    expect(screen.getByText(/選一個班級，看這一班的分數/)).toBeInTheDocument();
    expect(screen.getByText(/題庫啟用狀態/)).toBeInTheDocument();
  });

  it('完成評測後我的分析顯示總分與雷達圖', async () => {
    renderApp();
    await navigateToLogin();
    await registerUser('小美', 'mei@example.com', 'abcdef12');

    // Start survey from AssessmentHome.
    fireEvent.click(await screen.findByRole('button', { name: '開始作答' }));
    await screen.findByRole('button', { name: /送出評測/ });

    document.querySelectorAll('fieldset[data-question-id]').forEach((fs) => {
      const radios = fs.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[radios.length - 1]); // 5 分
    });
    fireEvent.click(screen.getByRole('button', { name: /送出評測/ }));

    // 送出後應該「就地」看到結果，不會被直接導頁到別的畫面。
    const inlineRegion = (await screen.findByText(/您的總得分/)).closest('section');
    // 每題選最後一個選項（5 分）：31 正向題 ×5 + 6 反向題 ×1 = 161。
    expect(within(inlineRegion).getByText('161')).toBeInTheDocument();
    expect(within(inlineRegion).getByLabelText('6 大構面能力雷達圖，各構面數值詳見下方表格')).toBeInTheDocument();

    // 使用者按下「查看完整分析」才離開作答頁，前往我的分析。
    fireEvent.click(screen.getByRole('button', { name: /查看完整分析/ }));

    expect(await screen.findByText('我的能力分析')).toBeInTheDocument();
    const region = (await screen.findByText(/您的總得分/)).closest('section');
    expect(within(region).getByText('161')).toBeInTheDocument();
    expect(within(region).getByLabelText('6 大構面能力雷達圖，各構面數值詳見下方表格')).toBeInTheDocument();
  });
});

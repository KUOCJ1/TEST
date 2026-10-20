import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MemberInvitesPanel from '../survey/coach/MemberInvitesPanel.jsx';
import RedeemInviteBox from '../survey/components/RedeemInviteBox.jsx';
import InviteBanner from '../survey/components/InviteBanner.jsx';
import LoginPage from '../survey/auth/LoginPage.jsx';
import { extractInviteCode } from '../survey/utils/inviteCode';
import { INVITE_TEMPLATES } from '../survey/data/invite-mail-templates';

const m = vi.hoisted(() => ({
  regenerateMemberInvite: vi.fn(), revokeMemberInvite: vi.fn(), sendMemberInvites: vi.fn(), redeemInvite: vi.fn(), updateGroup: vi.fn(),
  login: vi.fn(), register: vi.fn(),
}));
vi.mock('../survey/api/client', () => ({ api: m }));
vi.mock('../survey/auth/useAuth', () => ({ useAuth: () => ({ login: m.login, register: m.register }) }));
const buildCsvBlob = vi.hoisted(() => vi.fn());
vi.mock('../survey/utils/csvExport', () => ({ buildCsvBlob }));

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  buildCsvBlob.mockReset();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

const FUTURE = new Date(Date.now() + 5 * 864e5).toISOString();
const invites = [
  { id: 'a', email: 'ming@x.co', name: '小明', code: 'AAAAAAAAAA', link: 'https://s/?invite=AAAAAAAAAA', state: 'invited', expiresAt: FUTURE, sendCount: 0, mailSubject: '主旨甲', mailText: '小明 您好：請點 https://s/?invite=AAAAAAAAAA' },
  { id: 'b', email: 'old@x.co', name: '', code: 'BBBBBBBBBB', link: 'https://s/?invite=BBBBBBBBBB', state: 'expired', expiresAt: '2020-01-01T00:00:00Z', sendCount: 1, mailSubject: '主旨乙', mailText: '內文乙' },
  { id: 'c', email: 'done@x.co', name: '已加入', code: 'CCCCCCCCCC', link: 'https://s/?invite=CCCCCCCCCC', state: 'joined', expiresAt: FUTURE, sendCount: 1 },
];
const group = { id: 'g1', name: 'AI 實戰班' };

describe('學員邀請管理', () => {
  it('列出狀態與統計；已加入的不提供操作', () => {
    render(<MemberInvitesPanel group={group} invites={invites} mailConfigured={false} showToast={vi.fn()} />);
    expect(screen.getByText(/已加入 1 · 邀請中 1 · 已過期 1/)).toBeInTheDocument();
    expect(screen.getByText('已邀請，等對方註冊')).toBeInTheDocument();
    expect(screen.getByText('邀請已過期')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /撤銷 done@x\.co/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /撤銷 ming@x\.co/ })).toBeInTheDocument();
  });

  it('沒設定 SMTP：寄信按鈕停用並說明，其他功能可用；複製連結寫進剪貼簿', async () => {
    const showToast = vi.fn();
    render(<MemberInvitesPanel group={group} invites={invites} mailConfigured={false} showToast={showToast} />);
    expect(screen.getByRole('button', { name: /寄送全部邀請信/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: '寄送邀請信給 ming@x.co' })).toBeDisabled();
    expect(screen.getByText(/尚未設定寄信服務/, { selector: 'p' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '複製 ming@x.co 的邀請連結' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://s/?invite=AAAAAAAAAA'));
    expect(screen.queryByRole('button', { name: /複製 old@x\.co/ })).not.toBeInTheDocument(); // 過期的連結已失效，不給複製
  });

  it('複製全部只含有效的連結；匯出 CSV 含有效與過期、不含已加入', async () => {
    render(<MemberInvitesPanel group={group} invites={invites} mailConfigured={false} showToast={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /複製全部連結/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('小明\thttps://s/?invite=AAAAAAAAAA'));
    fireEvent.click(screen.getByRole('button', { name: /匯出連結清單/ }));
    const [rows, filename] = buildCsvBlob.mock.calls[0];
    expect(filename).toBe('AI 實戰班-邀請連結.csv');
    expect(rows[0]).toEqual(['姓名', 'Email', '邀請連結', '邀請碼', '狀態', '有效至', '主旨', '信件內容']);
    expect(rows.slice(1).map((r) => r[1])).toEqual(['ming@x.co', 'old@x.co']);
    // 郵件合併用：最後兩欄是寄給這個人的完整信件。
    expect(rows[1].slice(6)).toEqual(['主旨甲', '小明 您好：請點 https://s/?invite=AAAAAAAAAA']);
  });

  it('重新產生、撤銷、寄信都會呼叫 API 並要求父層重新載入', async () => {
    m.regenerateMemberInvite.mockResolvedValue({});
    m.revokeMemberInvite.mockResolvedValue({});
    m.sendMemberInvites.mockResolvedValue({ sent: 1, failed: [] });
    const onChanged = vi.fn().mockResolvedValue(undefined);
    render(<MemberInvitesPanel group={group} invites={invites} mailConfigured onChanged={onChanged} showToast={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '重新產生 ming@x.co 的邀請連結' }));
    await waitFor(() => expect(m.regenerateMemberInvite).toHaveBeenCalledWith('g1', 'a'));
    fireEvent.click(screen.getByRole('button', { name: '撤銷 old@x.co 的邀請' }));
    await waitFor(() => expect(m.revokeMemberInvite).toHaveBeenCalledWith('g1', 'b'));
    fireEvent.click(screen.getByRole('button', { name: '寄送邀請信給 ming@x.co' }));
    await waitFor(() => expect(m.sendMemberInvites).toHaveBeenCalledWith('g1', ['a']));
    fireEvent.click(screen.getByRole('button', { name: /寄送全部邀請信/ }));
    await waitFor(() => expect(m.sendMemberInvites).toHaveBeenCalledWith('g1'));
    expect(onChanged).toHaveBeenCalledTimes(4);
  });

  it('API 失敗時顯示原因；沒有邀請時說明怎麼建立', async () => {
    m.revokeMemberInvite.mockRejectedValue(new Error('無權限'));
    const { rerender } = render(<MemberInvitesPanel group={group} invites={invites} mailConfigured showToast={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '撤銷 ming@x.co 的邀請' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('無權限');
    rerender(<MemberInvitesPanel group={group} invites={[]} mailConfigured showToast={vi.fn()} />);
    expect(screen.getByText(/批量匯入名單/)).toBeInTheDocument();
  });
});

describe('邀請信內容（客戶承辦署名）', () => {
  const grp = { id: 'g1', name: 'AI 實戰班', inviteSubject: '', inviteBody: '' };

  it('複製整封信（主旨＋內文）', async () => {
    render(<MemberInvitesPanel group={grp} invites={invites} mailConfigured={false} showToast={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '複製寄給 ming@x.co 的整封信' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('主旨甲\n\n小明 您好：請點 https://s/?invite=AAAAAAAAAA'));
  });

  it('套用承辦窗口範本後可儲存；【】沒填會提醒；儲存呼叫 updateGroup 並回報更新後的班級', async () => {
    m.updateGroup.mockResolvedValue({ ...grp, inviteBody: 'x' });
    const onGroupUpdated = vi.fn();
    render(<MemberInvitesPanel group={grp} invites={invites} mailConfigured onGroupUpdated={onGroupUpdated} showToast={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /邀請信內容（預設）/ }));
    expect(screen.getByRole('button', { name: '儲存邀請信內容' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /套用範本：客戶承辦窗口寄出/ }));
    expect(screen.getByLabelText('內文').value).toContain('{{連結}}');
    expect(screen.getByLabelText('內文').value).toContain('承辦人姓名');
    expect(screen.getByText(/內文還有【…】的地方沒改/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '儲存邀請信內容' }));
    await waitFor(() => expect(m.updateGroup).toHaveBeenCalledWith('g1', expect.objectContaining({ inviteBody: expect.stringContaining('{{連結}}'), inviteSubject: expect.stringContaining('{{公司}}') })));
    await waitFor(() => expect(onGroupUpdated).toHaveBeenCalled());
  });

  it('已自訂時標示；改回預設會清空；儲存後才顯示預覽', async () => {
    m.updateGroup.mockResolvedValue({ ...grp });
    render(<MemberInvitesPanel group={{ ...grp, inviteBody: '自訂內文', inviteSubject: '自訂主旨' }} invites={invites} mailConfigured showToast={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /邀請信內容（已自訂）/ }));
    expect(screen.getByText(/預覽：寄給 小明 的信/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '改回預設' }));
    expect(screen.getByLabelText('內文')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: '儲存邀請信內容' }));
    await waitFor(() => expect(m.updateGroup).toHaveBeenCalledWith('g1', { inviteSubject: '', inviteBody: '' }));
  });

  it('範本的欄位都是系統支援的（不會寄出沒換掉的 {{…}}）', () => {
    const supported = new Set(['姓名', '班級', '公司', '講師', '連結', '邀請碼', '期限']);
    for (const t of INVITE_TEMPLATES) {
      for (const text of [t.subject, t.body]) {
        for (const [, key] of text.matchAll(/\{\{\s*([^{}\s]+)\s*\}\}/g)) expect(supported.has(key), `${t.id}: ${key}`).toBe(true);
      }
      expect(t.body).toContain('{{連結}}');
    }
  });
});

describe('輸入邀請碼', () => {
  it('extractInviteCode：接受連結、小寫、空白與連字號', () => {
    expect(extractInviteCode('https://assess.rong-rise.com/?invite=abcd2345ef')).toBe('ABCD2345EF');
    expect(extractInviteCode(' abcd-2345 ef ')).toBe('ABCD2345EF');
    expect(extractInviteCode('')).toBe('');
  });

  it('兌換成功通知父層；Email 不符等錯誤顯示原因', async () => {
    const onJoined = vi.fn();
    render(<RedeemInviteBox onJoined={onJoined} />);
    fireEvent.click(screen.getByRole('button', { name: '有教練給的邀請碼？' }));
    fireEvent.change(screen.getByLabelText('邀請碼或邀請連結'), { target: { value: 'https://x/?invite=abcde23456' } });
    m.redeemInvite.mockRejectedValueOnce(new Error('這個邀請是寄給另一個 Email（m***@x.co）'));
    fireEvent.click(screen.getByRole('button', { name: '加入班級' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('寄給另一個 Email');
    expect(m.redeemInvite).toHaveBeenCalledWith('ABCDE23456');
    m.redeemInvite.mockResolvedValueOnce({ id: 'g' });
    fireEvent.click(screen.getByRole('button', { name: '加入班級' }));
    await waitFor(() => expect(onJoined).toHaveBeenCalledWith({ id: 'g' }));
  });
});

describe('邀請連結落地頁', () => {
  const info = { groupName: 'AI 實戰班', companyName: '榕耀', coachName: '王教練', assessmentName: 'AI 職能評測', email: 'ming@x.co', name: '小明', expiresAt: FUTURE, accountExists: false };

  it('InviteBanner：查詢中、失效、有效三種', () => {
    const { rerender } = render(<InviteBanner info={null} />);
    expect(screen.getByRole('status')).toHaveTextContent('正在確認');
    rerender(<InviteBanner info={{ error: '這個邀請已經過期，請向教練索取新的邀請連結。', code: 'INVITE_EXPIRED' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('已經過期');
    rerender(<InviteBanner info={info} />);
    expect(screen.getByText('王教練邀請你加入班級')).toBeInTheDocument();
    expect(screen.getByText(/AI 實戰班．榕耀/)).toBeInTheDocument();
  });

  it('有效邀請：Email 鎖定並帶入、姓名預填；註冊時帶邀請碼，結果交給 App 導頁', async () => {
    m.register.mockResolvedValue({ user: {}, joinedGroup: { id: 'g1', assessmentId: 'ai-competency' }, inviteError: null });
    const onInviteResult = vi.fn();
    render(<LoginPage inviteCode="ABCDE23456" inviteInfo={info} onInviteResult={onInviteResult} />);
    const email = screen.getByPlaceholderText('you@example.com');
    expect(email).toHaveValue('ming@x.co');
    expect(email).toHaveAttribute('readonly');
    expect(screen.getByPlaceholderText('您的姓名')).toHaveValue('小明');
    expect(screen.getByRole('tab', { name: '註冊' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.change(screen.getByPlaceholderText('您的姓名'), { target: { value: '王小明' } });
    fireEvent.change(screen.getByPlaceholderText('至少 8 碼'), { target: { value: 'abcdef12' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成註冊並加入班級' }));
    await waitFor(() => expect(m.register).toHaveBeenCalledWith({
      name: '王小明', email: 'ming@x.co', password: 'abcdef12', acceptPolicy: true, inviteCode: 'ABCDE23456',
    }));
    expect(onInviteResult).toHaveBeenCalledWith({ joinedGroup: { id: 'g1', assessmentId: 'ai-competency' }, inviteError: null });
  });

  it('這個 Email 已有帳號：預設是登入，登入時帶邀請碼', async () => {
    m.login.mockResolvedValue({ user: {}, joinedGroup: { id: 'g1', assessmentId: 'ai-competency' }, inviteError: null });
    render(<LoginPage inviteCode="ABCDE23456" inviteInfo={{ ...info, accountExists: true }} onInviteResult={vi.fn()} />);
    expect(screen.getByRole('tab', { name: '登入' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.change(screen.getByPlaceholderText('至少 8 碼'), { target: { value: 'abcdef12' } });
    fireEvent.click(screen.getByRole('button', { name: '登入並加入班級' }));
    await waitFor(() => expect(m.login).toHaveBeenCalledWith({ email: 'ming@x.co', password: 'abcdef12', inviteCode: 'ABCDE23456' }));
  });

  it('邀請失效：顯示原因，表單照一般登入／註冊運作（不帶邀請碼、Email 不鎖）', async () => {
    m.login.mockResolvedValue({ user: {}, joinedGroup: null });
    const onInviteResult = vi.fn();
    render(<LoginPage inviteCode="OLDOLDOLD1" inviteInfo={{ error: '這個邀請已經過期，請向教練索取新的邀請連結。', code: 'INVITE_EXPIRED' }} onInviteResult={onInviteResult} />);
    expect(screen.getByRole('alert')).toHaveTextContent('已經過期');
    const email = screen.getByPlaceholderText('you@example.com');
    expect(email).not.toHaveAttribute('readonly');
    fireEvent.change(email, { target: { value: 'a@x.co' } });
    fireEvent.change(screen.getByPlaceholderText('至少 8 碼'), { target: { value: 'abcdef12' } });
    fireEvent.click(screen.getByRole('button', { name: '登入帳號' }));
    await waitFor(() => expect(m.login).toHaveBeenCalledWith({ email: 'a@x.co', password: 'abcdef12' }));
    expect(onInviteResult).not.toHaveBeenCalled();
  });

  it('沒有邀請連結的人可以輸入邀請碼前往邀請頁', () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, assign, search: '' } });
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: '有教練給的邀請碼？' }));
    fireEvent.change(screen.getByLabelText('邀請碼'), { target: { value: 'abcde-23456' } });
    fireEvent.click(screen.getByRole('button', { name: '前往' }));
    expect(assign).toHaveBeenCalledWith(expect.stringContaining('?invite=ABCDE23456'));
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });
});

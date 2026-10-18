import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
// ?raw：把伺服器那份常數檔當文字讀進來比對（不必真的 import 後端程式）。
import serverPolicySource from '../../server/src/lib/policy.js?raw';
import LegalPage from '../survey/marketing/LegalPage';
import ConsentGate from '../survey/legal/ConsentGate';
import LoginPage from '../survey/auth/LoginPage';
import { AuthContext } from '../survey/auth/useAuth';
import {
  POLICY_VERSION, POLICY_META, isPolicyDraft, needsConsent, needsConsentGate,
  PRIVACY_SECTIONS, TERMS_SECTIONS,
} from '../survey/legal/policy';

// Sprint 12：隱私權政策與註冊同意。

const READY = { status: 'published', operatorName: '範例顧問股份有限公司', contactEmail: 'privacy@example.com', effectiveDate: '2026-10-16' };

describe('政策版本與同意判斷', () => {
  it('前後端的 POLICY_VERSION 必須一致（server/src/lib/policy.js）', () => {
    const serverVersion = serverPolicySource.match(/POLICY_VERSION\s*=\s*'([^']+)'/)?.[1];
    expect(serverVersion).toBe(POLICY_VERSION);
  });

  it('草稿判斷：狀態不是 published，或經營者／聯絡信箱沒填，都算草稿', () => {
    expect(isPolicyDraft(READY)).toBe(false);
    expect(isPolicyDraft({ ...READY, status: 'draft' })).toBe(true);
    expect(isPolicyDraft({ ...READY, operatorName: '  ' })).toBe(true);
    expect(isPolicyDraft({ ...READY, contactEmail: '' })).toBe(true);
    // 負責人確認後已公開（2026-10-17）：經營者與聯絡信箱都填了，狀態是 published，閘門對既有用戶生效。
    expect(POLICY_META.status).toBe('published');
    expect(POLICY_META.operatorName.trim()).not.toBe('');
    expect(POLICY_META.contactEmail.trim()).not.toBe('');
    expect(isPolicyDraft(POLICY_META)).toBe(false);
    expect(needsConsentGate({}, POLICY_META)).toBe(true);
  });

  it('needsConsent：沒有紀錄或版本落後才需要；needsConsentGate 在草稿時不擋既有用戶', () => {
    const ok = { consent: { version: POLICY_VERSION } };
    expect(needsConsent(null)).toBe(false);
    expect(needsConsent({})).toBe(true);
    expect(needsConsent({ consent: { version: '2020-01-01' } })).toBe(true);
    expect(needsConsent(ok)).toBe(false);
    expect(needsConsentGate({}, READY)).toBe(true);
    expect(needsConsentGate(ok, READY)).toBe(false);
    expect(needsConsentGate({}, { ...READY, status: 'draft' })).toBe(false);
  });
});

describe('政策內容與實際行為一致（關鍵揭露都在）', () => {
  const textOf = (sections) => JSON.stringify(sections);

  it('領導力羅盤與接班準備度評測（2026-10-18 改版）：揭露新增的資料與可見對象', () => {
    const t = textOf(PRIVACY_SECTIONS);
    for (const k of ['職涯意向資料', '去留想法', '上級評分顯示同意', '同一類評分者達 3 位', '須由你同意', '稽核紀錄', '教練只看到彙整結果', '不是人才評分']) expect(t).toContain(k);
    const terms = textOf(TERMS_SECTIONS);
    expect(terms).toContain('領導力羅盤');
    expect(terms).toContain('接班準備度評測');
    expect(POLICY_VERSION).toBe('2026-10-18');
  });

  it('隱私權政策揭露第三方（OpenRouter、第二大腦、SMTP）與傳送內容，且不送姓名與 Email', () => {
    const t = textOf(PRIVACY_SECTIONS);
    for (const k of ['OpenRouter', '第二大腦', 'SMTP', '不送出姓名與 Email', '不含任何個人資料']) expect(t).toContain(k);
  });

  it('揭露誰看得到：教練與管理者可辨識他評評分者、教練可加入已註冊用戶', () => {
    const t = textOf(PRIVACY_SECTIONS);
    expect(t).toContain('可辨識評分者的身分');
    expect(t).toContain('把已註冊的用戶加入自己的班級');
  });

  it('如實說明保存與刪除：沒有自助刪除／匯出、沒有自動清除期限、備份輪替', () => {
    const t = textOf(PRIVACY_SECTIONS);
    expect(t).toContain('尚未設定自動清除期限');
    expect(t).toContain('沒有「自助刪除帳號」');
    expect(t).toContain('備份');
  });

  it('提到瀏覽器儲存、登入 cookie、不使用廣告或第三方追蹤', () => {
    const t = textOf(PRIVACY_SECTIONS);
    for (const k of ['localStorage', '登入 cookie', '不使用廣告 cookie']) expect(t).toContain(k);
  });

  it('服務條款：結果性質（非診斷、不作為單一人事決策依據）與 AI 小幫手免責', () => {
    const t = textOf(TERMS_SECTIONS);
    expect(t).toContain('不是醫療、心理診斷');
    expect(t).toContain('唯一依據');
    expect(t).toContain('AI 小幫手的回答由 AI 模型產生');
  });
});

describe('LegalPage', () => {
  const renderPage = (kind, meta) => render(<MemoryRouter><LegalPage kind={kind} meta={meta} /></MemoryRouter>);

  it('草稿時顯示草稿標記，並把待填欄位用醒目標記呈現（不編造公司資訊）', () => {
    renderPage('privacy', { ...READY, status: 'draft', operatorName: '', contactEmail: '' });
    expect(screen.getByRole('note')).toHaveTextContent('草稿，尚待確認');
    expect(screen.getAllByText('【待填：經營者名稱】').length).toBeGreaterThan(0);
    expect(screen.getAllByText('【待填：聯絡信箱】').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: '隱私權政策', level: 1 })).toBeInTheDocument();
  });

  it('草稿說明只講實際還缺的欄位：兩個都填了就不再說「還沒填」，但仍標示草稿', () => {
    renderPage('privacy', { ...READY, status: 'draft' });
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('草稿，尚待確認');
    expect(note).not.toHaveTextContent('還沒填');
    expect(screen.queryByText(/【待填/)).not.toBeInTheDocument();
  });

  it('只缺聯絡信箱時，說明裡點名缺的是聯絡信箱', () => {
    renderPage('privacy', { ...READY, status: 'draft', contactEmail: '' });
    expect(screen.getByRole('note')).toHaveTextContent('聯絡信箱還沒填');
    expect(screen.getByRole('note')).not.toHaveTextContent('經營者名稱還沒填');
  });

  it('填好並 published 後：沒有草稿標記，經營者與聯絡信箱出現在內文', () => {
    renderPage('privacy', READY);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.queryByText(/【待填/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/範例顧問股份有限公司/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/privacy@example\.com/).length).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(`版本 ${POLICY_VERSION}`))).toBeInTheDocument();
  });

  it('每個章節都有標題與目錄連結；表格容器可用鍵盤捲動；粗體標記被轉成強調', () => {
    renderPage('privacy', READY);
    for (const s of PRIVACY_SECTIONS) {
      expect(screen.getByRole('heading', { name: s.title, level: 2 })).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: s.title }).length).toBeGreaterThan(0);
    }
    for (const region of screen.getAllByRole('region', { name: /說明表格/ })) expect(region).toHaveAttribute('tabindex', '0');
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
    expect(screen.getAllByText('可辨識評分者的身分').some((el) => el.tagName === 'STRONG')).toBe(true);
  });

  it('服務條款頁有自己的標題與連回隱私權政策的連結', () => {
    renderPage('terms', READY);
    expect(screen.getByRole('heading', { name: '服務條款', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '另見《隱私權政策》' })).toHaveAttribute('href', '/privacy');
  });
});

describe('ConsentGate（既有用戶補同意）', () => {
  function renderGate(over = {}) {
    const auth = { user: { id: 'u1', name: '王小明' }, acceptPolicy: vi.fn().mockResolvedValue({}), logout: vi.fn(), ...over };
    render(<AuthContext.Provider value={auth}><ConsentGate /></AuthContext.Provider>);
    return auth;
  }

  it('顯示重點摘要與完整文件連結（另開分頁），按同意會呼叫 acceptPolicy', async () => {
    const auth = renderGate();
    expect(screen.getByText(/王小明，你好/)).toBeInTheDocument();
    expect(screen.getByText(/不含姓名與 Email/)).toBeInTheDocument();
    const privacy = screen.getByRole('link', { name: '閱讀完整隱私權政策' });
    expect(privacy).toHaveAttribute('target', '_blank');
    expect(privacy.getAttribute('rel')).toContain('noopener');
    fireEvent.click(screen.getByRole('button', { name: '我同意並繼續' }));
    await waitFor(() => expect(auth.acceptPolicy).toHaveBeenCalledTimes(1));
  });

  it('儲存失敗顯示錯誤，可以重試；不同意可以登出', async () => {
    const auth = renderGate({ acceptPolicy: vi.fn().mockRejectedValue(new Error('伺服器忙線')) });
    fireEvent.click(screen.getByRole('button', { name: '我同意並繼續' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('伺服器忙線');
    expect(screen.getByRole('button', { name: '我同意並繼續' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '不同意，登出' }));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });
});

describe('註冊頁的同意勾選', () => {
  function renderLogin(props = {}) {
    const auth = { register: vi.fn().mockResolvedValue({}), login: vi.fn().mockResolvedValue({}) };
    render(<AuthContext.Provider value={auth}><LoginPage {...props} /></AuthContext.Provider>);
    fireEvent.click(screen.getByRole('tab', { name: '註冊' }));
    fireEvent.change(screen.getByPlaceholderText('您的姓名'), { target: { value: '小明' } });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'ming@x.co' } });
    fireEvent.change(screen.getByPlaceholderText('至少 8 碼'), { target: { value: 'abcdef12' } });
    return auth;
  }

  it('沒勾選就送出：顯示原因、不呼叫註冊', () => {
    const auth = renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /建立帳號/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('請先勾選');
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('勾選後送出 acceptPolicy: true；帶報到代碼時一併送出', async () => {
    const auth = renderLogin({ joinCode: 'ABCD2345' });
    fireEvent.click(screen.getByRole('checkbox', { name: /隱私權政策/ }));
    fireEvent.click(screen.getByRole('button', { name: /建立帳號/ }));
    await waitFor(() => expect(auth.register).toHaveBeenCalledWith(expect.objectContaining({ name: '小明', email: 'ming@x.co', acceptPolicy: true, joinCode: 'ABCD2345' })));
  });

  it('勾選框旁的兩個連結另開分頁；登入模式不顯示勾選框、登入不送 acceptPolicy', async () => {
    const auth = renderLogin();
    const label = screen.getByRole('checkbox', { name: /隱私權政策/ }).closest('label');
    for (const name of ['隱私權政策', '服務條款']) {
      const a = within(label).getByRole('link', { name });
      expect(a).toHaveAttribute('target', '_blank');
    }
    fireEvent.click(screen.getByRole('tab', { name: '登入' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '登入帳號' }));
    await waitFor(() => expect(auth.login).toHaveBeenCalled());
    expect(auth.login.mock.calls[0][0]).not.toHaveProperty('acceptPolicy');
  });
});

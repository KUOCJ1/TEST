import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';
import { DEMO_ADMIN_PASSWORD } from '../survey/auth/authStore';

beforeEach(() => {
  localStorage.clear();
});

function fillLogin(email, password) {
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('至少 6 碼'), { target: { value: password } });
}

describe('App 流程', () => {
  it('未登入時顯示登入頁', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: '登入帳號' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  it('註冊後進入評測，且一般使用者看不到管理後台', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '註冊' }));
    fireEvent.change(screen.getByPlaceholderText('您的姓名'), { target: { value: '小明' } });
    fillLogin('ming@example.com', 'abcdef');
    fireEvent.click(screen.getByRole('button', { name: /建立帳號/ }));

    // 進入主畫面，顯示評測表單。
    expect(screen.getByRole('button', { name: /送出評測/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '管理後台' })).not.toBeInTheDocument();

    // 我的分析在尚未作答時顯示空狀態。
    fireEvent.click(screen.getByRole('button', { name: '我的分析' }));
    expect(screen.getByText('尚無評測紀錄')).toBeInTheDocument();
  });

  it('管理員登入後可見管理後台儀表板', () => {
    render(<App />);
    fillLogin('admin@demo.tw', DEMO_ADMIN_PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: '登入帳號' }));

    const adminTab = screen.getByRole('button', { name: '管理後台' });
    expect(adminTab).toBeInTheDocument();
    fireEvent.click(adminTab);
    expect(screen.getByText(/資料分析儀表板/)).toBeInTheDocument();
    expect(screen.getByText('註冊人數')).toBeInTheDocument();
  });

  it('完成評測後我的分析顯示總分與雷達圖', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '註冊' }));
    fireEvent.change(screen.getByPlaceholderText('您的姓名'), { target: { value: '小美' } });
    fillLogin('mei@example.com', 'abcdef');
    fireEvent.click(screen.getByRole('button', { name: /建立帳號/ }));

    // 全部選 5 分。
    document.querySelectorAll('fieldset[data-question-id]').forEach((fs) => {
      const radios = fs.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[radios.length - 1]);
    });
    fireEvent.click(screen.getByRole('button', { name: /送出評測/ }));

    // 送出後自動切換到「我的能力分析」。
    expect(screen.getByText('我的能力分析')).toBeInTheDocument();
    const region = screen.getByText(/您的 AI 職能總得分/).closest('section');
    expect(within(region).getByText('155')).toBeInTheDocument();
    expect(within(region).getByLabelText('六大構面能力雷達圖')).toBeInTheDocument();
  });
});

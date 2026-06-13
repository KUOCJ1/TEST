import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../App';

beforeEach(() => {
  localStorage.clear();
});

describe('Auth flow', () => {
  it('shows login page when not authenticated', () => {
    render(<App />);
    expect(screen.getByText('共享行事曆')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
  });

  it('can register a new account', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('註冊'));
    fireEvent.change(screen.getByPlaceholderText('你的名字'), { target: { value: '測試用戶' } });
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('至少 6 個字元'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('再次輸入密碼'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '建立帳號' }));
    // After registration, CalendarPage should show the user's name
    expect(await screen.findByText('測試用戶')).toBeInTheDocument();
  });

  it('shows error on wrong password', async () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), { target: { value: 'nobody@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getAllByRole('button', { name: '登入' })[0]);
    expect(await screen.findByText('Email 或密碼錯誤')).toBeInTheDocument();
  });
});

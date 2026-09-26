import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SystemStatusTab from '../survey/admin/SystemStatusTab';
import { isVersionMismatch } from '../survey/utils/buildInfo';
import { api } from '../survey/api/client';

vi.mock('../survey/api/client', () => ({ api: { adminSystemStatus: vi.fn() } }));

// Sprint 7 驗收條件 7.1、7.3。

function status(overrides = {}) {
  return {
    version: { commit: 'abc1234', builtAt: '2026-09-26T03:00:00Z' },
    deps: { secondBrain: { baseUrl: 'https://brain.test', ok: true, status: 200 }, openRouter: { configured: true } },
    mail: { configured: true },
    healthWatch: { intervalMinutes: 5, lastCheckedAt: new Date().toISOString() },
    connection: { ip: '203.0.113.5', ipLooksInternal: false, forwardedFor: '203.0.113.5', trustProxy: 2 },
    ...overrides,
  };
}

describe('isVersionMismatch', () => {
  it('兩邊都有版本號且不同才算不一致；任一邊是開發版（null）不判定', () => {
    expect(isVersionMismatch({ commit: 'a' }, { commit: 'b' })).toBe(true);
    expect(isVersionMismatch({ commit: 'a' }, { commit: 'a' })).toBe(false);
    expect(isVersionMismatch({ commit: null }, { commit: 'b' })).toBe(false);
    expect(isVersionMismatch({ commit: 'a' }, null)).toBe(false);
  });
});

describe('SystemStatusTab', () => {
  beforeEach(() => { api.adminSystemStatus.mockReset(); });

  it('顯示後端版本、外部依賴與伺服器看到的 IP', async () => {
    api.adminSystemStatus.mockResolvedValue(status());
    render(<SystemStatusTab />);
    expect(await screen.findByText(/後端：abc1234/)).toBeInTheDocument();
    expect(screen.getByText(/連線正常/)).toBeInTheDocument();
    expect(screen.getByText('203.0.113.5')).toBeInTheDocument();
    expect(screen.getByText(/和 whatismyip/)).toBeInTheDocument();
  });

  it('伺服器看到的是內網位址時，提示 TRUST_PROXY 可能設太低', async () => {
    api.adminSystemStatus.mockResolvedValue(status({
      connection: { ip: '::ffff:127.0.0.1', ipLooksInternal: true, forwardedFor: null, trustProxy: 0 },
    }));
    render(<SystemStatusTab />);
    expect(await screen.findByText(/TRUST_PROXY 設太低/)).toBeInTheDocument();
    expect(screen.getByText(/X-Forwarded-For：（無）/)).toBeInTheDocument();
  });

  it('第二大腦連不到、SMTP 沒設定時分別說明影響', async () => {
    api.adminSystemStatus.mockResolvedValue(status({
      deps: { secondBrain: { baseUrl: 'https://brain.test', ok: false, error: 'ECONNREFUSED' }, openRouter: { configured: false } },
      mail: { configured: false },
    }));
    render(<SystemStatusTab />);
    expect(await screen.findByText(/無法連線.*ECONNREFUSED/)).toBeInTheDocument();
    expect(screen.getByText(/AI 小幫手目前停用/)).toBeInTheDocument();
    expect(screen.getByText(/寄送提醒信」目前停用/)).toBeInTheDocument();
  });

  it('告警排程超過三個間隔沒有新紀錄時提示可能沒在跑', async () => {
    const old = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    api.adminSystemStatus.mockResolvedValue(status({ healthWatch: { intervalMinutes: 5, lastCheckedAt: old } }));
    render(<SystemStatusTab />);
    expect(await screen.findByText(/排程可能沒有在跑/)).toBeInTheDocument();
  });

  it('「重新檢查」會再打一次 API', async () => {
    api.adminSystemStatus.mockResolvedValue(status());
    render(<SystemStatusTab />);
    await screen.findByText(/後端：abc1234/);
    fireEvent.click(screen.getByRole('button', { name: /重新檢查/ }));
    await vi.waitFor(() => expect(api.adminSystemStatus).toHaveBeenCalledTimes(2));
  });

  it('載入失敗時顯示錯誤', async () => {
    api.adminSystemStatus.mockRejectedValue(new Error('無權限'));
    render(<SystemStatusTab />);
    expect(await screen.findByRole('alert')).toHaveTextContent('無權限');
  });
});

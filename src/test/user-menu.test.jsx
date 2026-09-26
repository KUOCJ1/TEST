import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UserMenu from '../survey/components/UserMenu';

// Sprint 8 驗收條件 8.2：個人設定／說明／手冊／登出收進使用者選單。

function setup() {
  const props = { onProfile: vi.fn(), onHelp: vi.fn(), onLogout: vi.fn() };
  render(<UserMenu user={{ name: '王小明', email: 'm@x.co' }} roleLabel="教練" manualHref="/manual.pdf" {...props} />);
  return props;
}
const trigger = () => screen.getByRole('button', { name: '王小明 的帳號選單' });

describe('UserMenu', () => {
  it('預設收合；點開後列出個人設定、使用說明、手冊下載、登出，並聚焦第一項', () => {
    setup();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent.trim());
    expect(items).toEqual(['個人設定', '使用說明', '手冊下載（PDF）', '登出']);
    expect(screen.getByRole('menuitem', { name: '個人設定' })).toHaveFocus();
    expect(screen.getByRole('menuitem', { name: /手冊下載/ })).toHaveAttribute('href', '/manual.pdf');
  });

  it('點選項目會執行對應動作並收合選單', () => {
    const props = setup();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('menuitem', { name: '登出' }));
    expect(props.onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('方向鍵移動、Esc 關閉並把焦點還給按鈕', () => {
    const props = setup();
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: '使用說明' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(screen.getByRole('menuitem', { name: '登出' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(props.onLogout).not.toHaveBeenCalled();
  });

  it('點選單外面會關閉', () => {
    setup();
    fireEvent.click(trigger());
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Collapsible from '../survey/components/Collapsible';

// 報告細節預設收起；點標題或章節導覽（#id）會展開；列印時一律展開（print:block）。
afterEach(() => { window.location.hash = ''; });

describe('Collapsible', () => {
  it('預設收起，點標題展開與收起', () => {
    render(<Collapsible id="sec-a" title="各構面分數明細" summary="9 個構面"><p>內容</p></Collapsible>);
    const btn = screen.getByRole('button', { name: /各構面分數明細/ });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('sec-a-body')).toHaveClass('hidden', 'print:block');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('sec-a-body')).not.toHaveClass('hidden');
  });

  it('章節導覽連到 #id 時自動展開', async () => {
    render(<Collapsible id="sec-b" title="完整敘事報告"><p>內容</p></Collapsible>);
    await act(async () => {
      window.location.hash = '#sec-b';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('button', { name: /完整敘事報告/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('defaultOpen 時一開始就展開', () => {
    render(<Collapsible id="sec-c" title="標題" defaultOpen><p>內容</p></Collapsible>);
    expect(screen.getByRole('button', { name: /標題/ })).toHaveAttribute('aria-expanded', 'true');
  });
});

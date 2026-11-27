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
    // 內容區 id 帶唯一後綴（同頁兩份報告時不會互相指到）；用 aria-controls 找。
    const body = () => document.getElementById(btn.getAttribute('aria-controls'));
    expect(body()).toHaveClass('hidden', 'print:block');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(body()).not.toHaveClass('hidden');
  });

  it('章節導覽連到 #id 時自動展開', async () => {
    render(<Collapsible id="sec-b" title="完整敘事報告"><p>內容</p></Collapsible>);
    await act(async () => {
      window.location.hash = '#sec-b';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('button', { name: /完整敘事報告/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('收合後再點同一個章節連結（網址已在 #id、不會觸發 hashchange）也會重新展開', () => {
    render(<><a href="#sec-d">章節</a><Collapsible id="sec-d" title="敘事報告"><p>內容</p></Collapsible></>);
    const btn = screen.getByRole('button', { name: /敘事報告/ });
    fireEvent.click(screen.getByRole('link', { name: '章節' }));
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(btn); // 收合
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('link', { name: '章節' }));
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  it('同頁兩份報告：內容區 id 不重複', () => {
    render(<><Collapsible id="sec-e" title="甲"><p>1</p></Collapsible><Collapsible id="sec-e" title="乙"><p>2</p></Collapsible></>);
    const [a, b] = screen.getAllByRole('button').map((x) => x.getAttribute('aria-controls'));
    expect(a).not.toBe(b);
  });

  it('defaultOpen 時一開始就展開', () => {
    render(<Collapsible id="sec-c" title="標題" defaultOpen><p>內容</p></Collapsible>);
    expect(screen.getByRole('button', { name: /標題/ })).toHaveAttribute('aria-expanded', 'true');
  });
});

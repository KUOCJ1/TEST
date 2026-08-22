import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AboutPage from '../survey/marketing/AboutPage';
import HowItWorksPage from '../survey/marketing/HowItWorksPage';
import ShowcasePage from '../survey/marketing/ShowcasePage';
import FaqPage from '../survey/marketing/FaqPage';
import { MARKETING_LINKS } from '../survey/marketing/links';

const PAGES = [
  ['理念頁', AboutPage],
  ['功能總覽', HowItWorksPage],
  ['範例報告', ShowcasePage],
  ['常見問題', FaqPage],
];

function renderPage(Page, props = {}) {
  return render(
    <MemoryRouter>
      <Page loggedIn={false} onEnter={() => {}} {...props} />
    </MemoryRouter>,
  );
}

describe('行銷頁', () => {
  it.each(PAGES)('%s 能渲染並帶出所有導覽連結', (_name, Page) => {
    renderPage(Page);
    MARKETING_LINKS.forEach((l) => {
      expect(screen.getAllByRole('link', { name: l.label }).length).toBeGreaterThan(0);
    });
  });

  it.each(PAGES)('%s 未登入時 CTA 觸發登入流程', (_name, Page) => {
    const onEnter = vi.fn();
    renderPage(Page, { onEnter });
    fireEvent.click(screen.getAllByRole('button', { name: '登入平台' })[0]);
    expect(onEnter).toHaveBeenCalled();
  });

  it.each(PAGES)('%s 已登入時改顯示前往我的評量，不再要求登入', (_name, Page) => {
    renderPage(Page, { loggedIn: true });
    expect(screen.getAllByRole('link', { name: '前往我的評量' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: '登入平台' })).not.toBeInTheDocument();
  });

  it('範例報告頁標示為示意資料，避免被誤認為真實學員成績', () => {
    renderPage(ShowcasePage);
    expect(screen.getByText(/示意資料/)).toBeInTheDocument();
  });

  it('範例報告頁畫出雷達圖、趨勢圖與構面熱力圖', () => {
    const { container } = renderPage(ShowcasePage);
    expect(container.querySelector('svg[aria-label*="雷達圖"]')).toBeTruthy();
    expect(container.querySelector('svg[aria-label*="趨勢"]')).toBeTruthy();
    expect(screen.getByText('構面 × 成員熱力圖')).toBeInTheDocument();
  });
});

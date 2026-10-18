import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GuidePage from '../survey/marketing/GuidePage.jsx';
import AssessmentCard from '../survey/components/AssessmentCard.jsx';
import SurveyApp from '../survey/SurveyApp.jsx';
import LandingPage from '../survey/LandingPage.jsx';
import { ConfirmProvider } from '../survey/components/ConfirmDialog';
import { REGISTRY, getAssessment } from '../survey/data/assessments/index.js';
import { GUIDES, guidePathFor } from '../survey/data/assessment-guides.js';

vi.mock('../survey/api/client', () => ({
  api: { createSubmission: vi.fn(), myGroups: async () => [], mySubmissions: async () => [], learningResources: async () => [], myReadingList: async () => [], addToReadingList: async () => ({}), trackArticleClick: async () => {}, myGoals: async () => [] },
}));

const renderGuide = (id) => render(
  <MemoryRouter initialEntries={[`/guide/${id}`]}>
    <Routes>
      <Route path="/guide/:assessmentId" element={<GuidePage />} />
      <Route path="/framework" element={<div>框架頁</div>} />
    </Routes>
  </MemoryRouter>,
);

describe('每個評測都有說明', () => {
  it('所有已註冊的評測：有編輯層說明，或有專屬的框架頁（新增評測沒寫說明會讓這個測試失敗）', () => {
    Object.values(REGISTRY).forEach((c) => {
      expect(Boolean(GUIDES[c.ID]) || Boolean(c.FRAMEWORK_PATH), c.ID).toBe(true);
    });
  });
  it('編輯層說明的 id 都對得到評測；用詞不評判', () => {
    Object.keys(GUIDES).forEach((id) => expect(getAssessment(id), id).toBeTruthy());
    expect(JSON.stringify(GUIDES)).not.toMatch(/待強化|不及格|落後|很差|失敗/);
    Object.values(GUIDES).forEach((g) => { expect(g.howToRead.length).toBeGreaterThan(1); expect(g.purpose.length).toBeGreaterThan(30); });
  });
  it('guidePathFor：羅盤用 /framework，其他用 /guide/:id', () => {
    expect(guidePathFor('leadership-compass', getAssessment('leadership-compass'))).toBe('/framework');
    expect(guidePathFor('disc', getAssessment('disc'))).toBe('/guide/disc');
  });
});

describe('GuidePage（從題庫設定算出結構資訊）', () => {
  Object.keys(GUIDES).forEach((id) => {
    it(`${id}：顯示名稱、全部構面、題數與量表`, () => {
      const cfg = getAssessment(id);
      const { container } = renderGuide(id);
      expect(screen.getByRole('heading', { level: 1, name: cfg.NAME })).toBeInTheDocument();
      cfg.DIMENSIONS.forEach((d) => expect(screen.getAllByText(d.name, { exact: false }).length, d.name).toBeGreaterThan(0));
      expect(container.textContent).toContain(`共 ${cfg.TOTAL_QUESTIONS} 題`);
      expect(container.textContent).toContain('5 點量表');
      expect(container.textContent).not.toMatch(/NaN|undefined/);
    });
  });

  it('分數型評測列出落點等級；風格型列出可能的結果且說明沒有高低之分', () => {
    const l9 = renderGuide('leadership-9d').container.textContent;
    expect(l9).toContain('整體落點等級');
    expect(l9).toContain('90–225 分');
    expect(l9).toContain('三個圈層');
    const disc = renderGuide('disc').container.textContent;
    expect(disc).toContain('沒有高低之分');
    expect(disc).not.toContain('整體落點等級');
  });
  it('360° 說明依評測是否支援而不同', () => {
    expect(renderGuide('leadership-9d').container.textContent).toContain('支援 360° 他評');
    expect(renderGuide('archetype').container.textContent).toContain('不開放 360° 他評');
  });
  it('領導力羅盤導向 /framework；不存在的評測顯示找不到', () => {
    renderGuide('leadership-compass');
    expect(screen.getByText('框架頁')).toBeInTheDocument();
    renderGuide('no-such');
    expect(screen.getByText('找不到這份評測的說明')).toBeInTheDocument();
  });
});

describe('入口連結', () => {
  const props = { latestSubmission: null, groupPhase: null, submittedPhases: null, onStart: () => {}, onViewAnalysis: () => {}, onGoTo360: () => {} };
  it('評量卡片（不需要 Router）：有說明的評測顯示新分頁連結', () => {
    render(<AssessmentCard assessment={{ id: 'ai-competency', name: 'AI', description: 'x' }} {...props} />);
    const link = screen.getByRole('link', { name: '先了解這份評測' });
    expect(link).toHaveAttribute('href', '/guide/ai-competency');
    expect(link).toHaveAttribute('target', '_blank');
  });
  it('作答頁：非羅盤的評測有「先看這份評測…」的連結', () => {
    render(<MemoryRouter><ConfirmProvider><SurveyApp assessmentId="disc" user={{ id: 'u', name: 'x' }} /></ConfirmProvider></MemoryRouter>);
    expect(screen.getByRole('link', { name: /先看這份評測在看什麼/ })).toHaveAttribute('href', '/guide/disc');
  });
  it('首頁評測工具庫：六份評測都有卡片與說明連結；尚未開放的標示「即將推出」', () => {
    render(<MemoryRouter><LandingPage loggedIn={false} onEnter={() => {}} /></MemoryRouter>);
    const links = screen.getAllByRole('link', { name: /了解這份評測/ }).map((l) => l.getAttribute('href'));
    expect(links).toEqual(expect.arrayContaining(['/guide/ai-competency', '/guide/leadership-9d', '/guide/disc', '/guide/archetype', '/framework', '/guide/succession-intent']));
    expect(screen.getAllByText('即將推出')).toHaveLength(2);
    expect(screen.getByText('領導力羅盤八向評測')).toBeInTheDocument();
    expect(screen.getByText('接班準備度評測')).toBeInTheDocument();
  });
  it('首頁統計的評測工具數等於摘要的數量', () => {
    render(<MemoryRouter><LandingPage loggedIn={false} onEnter={() => {}} /></MemoryRouter>);
    const label = screen.getByText('評測工具 Assessments');
    expect(label.nextElementSibling.textContent).toBe(String(Object.keys(REGISTRY).length));
  });
});

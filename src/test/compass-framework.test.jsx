import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FrameworkPage from '../survey/marketing/FrameworkPage.jsx';
import CompassIntro from '../survey/components/compass/CompassIntro.jsx';
import AssessmentCard from '../survey/components/AssessmentCard.jsx';
import ResultPanel from '../survey/components/ResultPanel.jsx';
import SurveyApp from '../survey/SurveyApp.jsx';
import { ConfirmProvider } from '../survey/components/ConfirmDialog';
import * as compass from '../survey/data/assessments/leadership-compass.js';
import { DIMENSION_INTRO, TENSION_INTRO, LOOP_INTRO, FRAMEWORK_PATH } from '../survey/data/assessments/compass-framework.js';

vi.mock('../survey/api/client', () => ({
  api: {
    createSubmission: vi.fn(), myGroups: async () => [], mySubmissions: async () => [], learningResources: async () => [],
    myReadingList: async () => [], addToReadingList: async () => ({}), trackArticleClick: async () => {}, myGoals: async () => [],
  },
}));
beforeEach(() => localStorage.clear());

const wrap = (ui) => render(<MemoryRouter><ConfirmProvider>{ui}</ConfirmProvider></MemoryRouter>);

describe('框架說明內容與題庫設定一致', () => {
  it('八個構面與所有子面向的名稱和設定檔完全一致，且所屬的環正確', () => {
    expect(DIMENSION_INTRO.map((d) => d.id)).toEqual(compass.DIMENSIONS.map((d) => d.id));
    DIMENSION_INTRO.forEach((d) => {
      const cfg = compass.DIMENSIONS.find((x) => x.id === d.id);
      expect(d.subs.map(([n]) => n), d.id).toEqual(cfg.subDimensions.map((s) => s.name));
      expect(d.loop).toBe(cfg.loop);
    });
  });
  it('兩個環的步驟名稱等於設定檔構面名稱；四組張力與設定檔相同', () => {
    const names = Object.fromEntries(compass.DIMENSIONS.map((d) => [d.id, d.name]));
    compass.LOOPS.forEach((l) => expect(LOOP_INTRO[l.id].steps).toEqual(l.dimensionIds.map((id) => names[id])));
    expect(TENSION_INTRO.map((t) => [t.a, t.b])).toEqual(compass.TENSIONS.map((t) => [t.nameA, t.nameB]));
  });
  it('框架頁路徑一致', () => expect(compass.FRAMEWORK_PATH).toBe(FRAMEWORK_PATH));
  it('說明文字不評判、不揭露題目原文', () => {
    const all = JSON.stringify([DIMENSION_INTRO, TENSION_INTRO]);
    expect(all).not.toMatch(/待強化|不及格|落後|很差|失敗|不適任/);
    compass.ALL_QUESTIONS.forEach((q) => expect(all.includes(q.text), q.id).toBe(false));
  });
});

describe('FrameworkPage（公開）', () => {
  it('顯示名稱、兩個環、八構面（含錨點 id）、四組張力、隱私與怎麼讀', () => {
    const { container } = wrap(<FrameworkPage loggedIn={false} onEnter={() => {}} />);
    expect(screen.getByRole('heading', { level: 1, name: '領導力羅盤八向評測' })).toBeInTheDocument();
    expect(screen.getByText('人會走，能力要留下；反應要快，培育要久。')).toBeInTheDocument();
    ['find', 'aim', 'staff', 'team', 'learn', 'anchor', 'sow', 'transfer'].forEach((id) => expect(container.querySelector(`#${id}`), id).toBeTruthy());
    ['應變環', '養成環'].forEach((n) => expect(screen.getAllByText(n).length).toBeGreaterThan(0));
    expect(screen.getByText('聚焦 ↔ 彈性')).toBeInTheDocument();
    expect(screen.getByText('機制 ↔ 個人權威')).toBeInTheDocument();
    expect(screen.getByText(/達 3 位才會單獨顯示/)).toBeInTheDocument();
    expect(screen.getByText('看的是頻率，不是能力高低')).toBeInTheDocument();
    screen.getAllByRole('link', { name: '隱私權政策' }).forEach((l) => expect(l).toHaveAttribute('href', '/privacy'));
  });
  it('有 hash 時捲到對應構面', () => {
    const spy = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = spy;
    window.history.pushState({}, '', '/framework#sow');
    wrap(<FrameworkPage />);
    expect(spy).toHaveBeenCalled();
    window.history.pushState({}, '', '/');
  });
});

describe('CompassIntro（作答前導讀）', () => {
  it('第一次預設展開；收起後記住，下次預設收起', () => {
    const first = wrap(<CompassIntro />);
    const details = first.container.querySelector('details');
    expect(details.open).toBe(true);
    details.open = false;
    fireEvent(details, new Event('toggle'));
    first.unmount();
    const second = wrap(<CompassIntro />);
    expect(second.container.querySelector('details').open).toBe(false);
  });
  it('連到框架頁（新分頁）；評分者看到的是「無法判斷」說明', () => {
    wrap(<CompassIntro rater="other" />);
    const link = screen.getByRole('link', { name: '看完整的框架說明' });
    expect(link).toHaveAttribute('href', '/framework');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText(/選「無法判斷」/)).toBeInTheDocument();
  });
  it('作答頁出現導讀；其他題庫的作答頁沒有', () => {
    const a = wrap(<SurveyApp assessmentId="leadership-compass" user={{ id: 'u', name: 'x' }} />);
    expect(screen.getByText('先認識這份評測（約 1 分鐘）')).toBeInTheDocument();
    a.unmount();
    wrap(<SurveyApp assessmentId="disc" user={{ id: 'u', name: 'x' }} />);
    expect(screen.queryByText('先認識這份評測（約 1 分鐘）')).not.toBeInTheDocument();
  });
});

describe('入口連結', () => {
  it('評量卡片：羅盤有「先了解這份評測的框架」，其他評量沒有', () => {
    const props = { latestSubmission: null, groupPhase: null, submittedPhases: new Set(), onStart: () => {}, onViewAnalysis: () => {}, onGoTo360: () => {} };
    const a = wrap(<AssessmentCard assessment={{ id: 'leadership-compass', name: '領導力羅盤八向評測', description: 'x' }} {...props} />);
    expect(screen.getByRole('link', { name: '先了解這份評測的框架' })).toHaveAttribute('href', '/framework');
    a.unmount();
    wrap(<AssessmentCard assessment={{ id: 'disc', name: 'DISC', description: 'x' }} {...props} />);
    expect(screen.queryByRole('link', { name: '先了解這份評測的框架' })).not.toBeInTheDocument();
  });
  it('報告：每個構面名稱連到框架頁對應錨點，另有「看框架說明」', () => {
    const view = compass.selectForm('full');
    const r = compass.SCORING.buildResult(Object.fromEntries(view.ALL_QUESTIONS.map((q) => [q.id, 3])), view);
    wrap(<ResultPanel result={r} onRetake={() => {}} onCopy={() => {}} copied={false} />);
    expect(screen.getByRole('link', { name: '洞察情勢' })).toHaveAttribute('href', '/framework#find');
    expect(screen.getByRole('link', { name: '傳承留能' })).toHaveAttribute('href', '/framework#transfer');
    expect(screen.getByRole('link', { name: '看框架說明' })).toHaveAttribute('href', '/framework');
  });
});

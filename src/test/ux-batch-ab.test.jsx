import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AssessmentCard from '../survey/components/AssessmentCard.jsx';
import ResultPanel from '../survey/components/ResultPanel.jsx';
import HelpModal from '../survey/components/HelpModal.jsx';
import UserMenu from '../survey/components/UserMenu.jsx';
import SurveyApp from '../survey/SurveyApp.jsx';
import MultiRaterHome from '../survey/analysis/MultiRaterHome.jsx';
import { ConfirmProvider } from '../survey/components/ConfirmDialog';
import { estimateMinutes, cardSize, GUIDES } from '../survey/data/assessment-guides.js';
import { getAssessment } from '../survey/data/assessments/index.js';
import { buildResult } from '../survey/utils/scoring';
import * as si from '../survey/data/assessments/succession-intent.js';
import SuccessionResultPanel from '../survey/components/succession/SuccessionResultPanel.jsx';

const { members } = vi.hoisted(() => ({ members: { list: [] } }));
vi.mock('../survey/api/client', () => ({
  api: {
    createSubmission: vi.fn(), myGroups: async () => [], mySubmissions: async () => [], learningResources: async () => [],
    myReadingList: async () => [], addToReadingList: async () => ({}), trackArticleClick: async () => {}, myGoals: async () => [],
    assessments: async () => [{ id: 'leadership-9d', name: 'L9D', description: 'x', enabled: true }],
    groupMembers: async () => members.list, rateeSubmissions: async () => [],
  },
}));
beforeEach(() => { localStorage.clear(); members.list = []; });

const props = { latestSubmission: null, groupPhase: null, submittedPhases: null, onStart: () => {}, onViewAnalysis: () => {}, onGoTo360: () => {} };

describe('A1 評量卡片：白話一句話與時間', () => {
  it('時間粗估：每題 15–20 秒', () => {
    expect(estimateMinutes(37)).toBe('約 9–12 分鐘');
    expect(estimateMinutes(20)).toBe('約 5–7 分鐘');
    expect(estimateMinutes(1)).toMatch(/約 1/);
  });
  it('卡片用白話描述取代內部語言（不再出現「含反向題」「風格輪廓型」）', () => {
    render(<AssessmentCard assessment={{ id: 'leadership-9d', name: 'L9D', description: '9 大構面、90 題，含反向題' }} {...props} />);
    expect(screen.queryByText(/含反向題/)).not.toBeInTheDocument();
    expect(screen.getByText(/做完拿到每個構面的等級/)).toBeInTheDocument();
    expect(screen.getByText(/90 題（約 23–30 分鐘）/)).toBeInTheDocument();
  });
  it('沒有編輯層說明的評量沿用資料庫描述', () => {
    render(<AssessmentCard assessment={{ id: 'unknown-x', name: 'X', description: '資料庫裡的描述' }} {...props} />);
    expect(screen.getByText('資料庫裡的描述')).toBeInTheDocument();
  });
  it('雙環領導羅盤同時列出精簡版與完整版的題數與時間', () => {
    const t = cardSize(getAssessment('leadership-compass'));
    expect(t).toContain('精簡版 32 題');
    expect(t).toContain('完整版 69 題');
  });
  it('每份評測都有白話描述', () => {
    Object.entries(GUIDES).forEach(([id, g]) => { expect(g.blurb.length, id).toBeGreaterThan(20); expect(g.blurb).not.toMatch(/反向題|輪廓型/); });
  });
});

describe('A2 報告頁有「看這份評測怎麼讀」', () => {
  it('分數型（AI 職能）與風格型報告都有連結，指向對應說明頁', () => {
    const ai = getAssessment('ai-competency');
    const r = buildResult(Object.fromEntries(ai.ALL_QUESTIONS.map((q) => [q.id, 3])), ai);
    const a = render(<MemoryRouter><ResultPanel result={r} onRetake={() => {}} onCopy={() => {}} copied={false} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: '看這份評測怎麼讀' })).toHaveAttribute('href', '/guide/ai-competency');
    a.unmount();
    const disc = getAssessment('disc');
    const rd = buildResult(Object.fromEntries(disc.ALL_QUESTIONS.map((q) => [q.id, 4])), disc);
    render(<MemoryRouter><ResultPanel result={rd} onRetake={() => {}} onCopy={() => {}} copied={false} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: '看這份評測怎麼讀' })).toHaveAttribute('href', '/guide/disc');
  });
  it('接班準備度評測的報告也有', () => {
    const r = si.SCORING.buildResult(Object.fromEntries(si.ALL_QUESTIONS.map((q) => [q.id, 4])), si);
    render(<MemoryRouter><SuccessionResultPanel result={r} onRetake={() => {}} onCopy={() => {}} copied={false} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: '看這份問卷的完整說明' })).toHaveAttribute('href', '/guide/succession-intent');
  });
});

describe('A3 帳號選單與 A4 作答頁', () => {
  it('帳號選單有服務條款與常見問題，都在新分頁開啟', () => {
    render(<UserMenu user={{ name: '王', email: 'a@b.co' }} manualHref="/m.pdf" />);
    fireEvent.click(screen.getByRole('button', { name: /帳號選單/ }));
    const terms = screen.getByRole('menuitem', { name: '服務條款' });
    const faq = screen.getByRole('menuitem', { name: '常見問題' });
    expect(terms.getAttribute('href')).toMatch(/terms$/);
    expect(faq.getAttribute('href')).toMatch(/faq$/);
    [terms, faq].forEach((l) => expect(l).toHaveAttribute('target', '_blank'));
  });
  it('作答一開始就提示進度會自動儲存', () => {
    render(<MemoryRouter><ConfirmProvider><SurveyApp assessmentId="disc" user={{ id: 'u', name: 'x' }} /></ConfirmProvider></MemoryRouter>);
    expect(screen.getByText(/進度會自動儲存在這個瀏覽器/)).toBeInTheDocument();
  });
});

describe('B 說明系統', () => {
  it('應用內說明：不再把落點等級／百分位當成所有評量都有；有 360° 前提、我的學習與評測說明', () => {
    render(<HelpModal role="user" onClose={() => {}} />);
    const t = document.body.textContent;
    expect(t).toContain('結果的呈現方式');
    expect(t).toContain('只有分數型評量才有');
    expect(t).toContain('快環、永環與張力');
    expect(t).toContain('需要先加入班級');
    expect(t).toContain('我的學習');
    expect(t).toContain('先了解這份評測');
    expect(t).not.toContain('限領導力評量');
    expect(t).toContain('作答到一半離開，會不會不見');
    expect(t).toContain('我還沒加入班級，可以做什麼');
  });
  it('360° 頁：先說明什麼是 360° 與限同班；沒有班級時給具體的加入步驟', async () => {
    render(<MemoryRouter><MultiRaterHome user={{ id: 'u', name: 'x' }} onRateOthers={() => {}} /></MemoryRouter>);
    expect(await screen.findByText(/限定為/)).toBeInTheDocument();
    expect(screen.getByText('您目前還沒有可以評測的對象')).toBeInTheDocument();
    expect(screen.getByText(/報到 QR Code 或連結/)).toBeInTheDocument();
    expect(screen.getByText(/仍然可以自己作答並查看分析/)).toBeInTheDocument();
  });
});

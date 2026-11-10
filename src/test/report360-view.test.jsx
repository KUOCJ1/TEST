import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ThreeSixtyReport from '../survey/components/ThreeSixtyReport.jsx';
import { api } from '../survey/api/client';
import { getAssessment } from '../survey/data/assessments/index.js';
import { buildResult } from '../survey/utils/scoring.js';

const cfg = getAssessment('leadership-360-70');
const sub = (raterType, userId, v) => ({ userId, raterType, createdAt: '2026-11-01T00:00:00Z', result: buildResult(Object.fromEntries(cfg.ALL_QUESTIONS.map((q) => [q.id, v])), cfg) });

describe('360° 報告新版面：目錄、評分者群組橫條、子能力排名', () => {
  let portal;
  beforeEach(() => { portal = document.createElement('div'); portal.id = 'report-portal'; document.body.appendChild(portal); });
  afterEach(() => { portal.remove(); vi.restoreAllMocks(); });

  it('依序出現：目錄、評量項目與定義、評估方式、…、子能力排名；群組橫條只畫有人評分的群組', async () => {
    vi.spyOn(api, 'rateeSubmissions').mockResolvedValue([sub('self', 'r', 5), sub('manager', 'm', 3), sub('subordinate', 's1', 4)]);
    render(<ThreeSixtyReport rateeId="r" rateeName="受評者" assessmentId="leadership-360-70" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('報告目錄與閱讀指引')).toBeInTheDocument());
    const text = portal.textContent;
    const order = ['報告目錄與閱讀指引', '評量項目與定義', '評估方式', '整體評價', '各構面：自評與各類評分者', '子能力排名', '構面與子能力詳述', '發展建議'];
    let last = -1;
    order.forEach((t) => { const i = text.indexOf(t, last + 1); expect(i, t).toBeGreaterThan(last); last = i; });
    // 沒有同儕 → 群組橫條沒有「同儕」列、圖例也沒有
    expect(portal.querySelectorAll('#chart-dim-groups [aria-label*="同儕"]')).toHaveLength(0);
    expect(portal.querySelectorAll('#chart-dim-groups [aria-label*="主管"]').length).toBe(8);
    expect(portal.querySelectorAll('#chart-dim-groups [aria-label*="部屬"]').length).toBe(8);
    // 自評 5、主管 3 → 構面落差 2 ≥ 1.0，每個構面都標紅色箭頭
    expect(portal.querySelectorAll('#chart-dim-groups [aria-label^="群組間落差"]')).toHaveLength(8);
    // 子能力排名 18 列；自評 5／他評 3.5 → 全部在強項區或發展機會區
    expect(portal.querySelectorAll('#chart-sub-ranking [role="img"]')).toHaveLength(18);
    // 每個構面都有子能力橫條區
    expect(portal.querySelectorAll('[id^="sub-groups-"]')).toHaveLength(8);
  });

  it('只有自評：不出現他評相關的橫條，排名以自評為依據', async () => {
    vi.spyOn(api, 'rateeSubmissions').mockResolvedValue([sub('self', 'r', 4)]);
    render(<ThreeSixtyReport rateeId="r" rateeName="受評者" assessmentId="leadership-360-70" onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText("子能力排名").length).toBeGreaterThan(1));
    expect(portal.querySelectorAll('#chart-dim-groups [aria-label^="群組間落差"]')).toHaveLength(0);
    expect(portal.textContent).toContain('依自評的分數由高到低排列');
  });
});

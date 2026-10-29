import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CoursePostSurvey from '../survey/course/CoursePostSurvey.jsx';
import CourseSurveyPanel, { CourseSurveyToggle } from '../survey/coach/CourseSurveyPanel.jsx';
import * as config from '../survey/data/assessments/ai-course-post.js';
import { DIMENSIONS as AI_DIMENSIONS } from '../survey/data/assessments/ai-competency.js';
import { getAssessment } from '../survey/data/assessments/index.js';
import {
  COURSE_DIMENSIONS, SJT_KEY, BARRIER_CODES, MODULE_COUNT, buildCourseResult, summarizeCourseSurvey, requiredKeys as serverRequiredKeys,
} from '../../server/src/lib/courseSurvey.js';

const m = vi.hoisted(() => ({
  mySubmissions: vi.fn(), createSubmission: vi.fn(), setCourseFollowUp: vi.fn(), getCourseSurveySummary: vi.fn(), updateGroup: vi.fn(), createGoal: vi.fn(),
}));
vi.mock('../survey/api/client', () => ({ api: m }));

beforeEach(() => { Object.values(m).forEach((f) => f.mockReset()); localStorage.clear(); });

const answersFor = () => {
  const a = {};
  for (const k of serverRequiredKeys()) a[k] = 4;
  a.a9 = 9;
  for (const [id, key] of Object.entries(SJT_KEY)) a[id] = key;
  a.d7 = 'yes';
  return a;
};

function fillAll({ skip = [] } = {}) {
  const a = answersFor();
  for (const [k, v] of Object.entries(a)) {
    if (skip.includes(k)) continue;
    const input = document.querySelector(`input[name="${k}"][value="${v}"]`);
    expect(input, k).toBeTruthy();
    fireEvent.click(input);
  }
}

const renderSurvey = () => render(<MemoryRouter><CoursePostSurvey user={{ id: 'u1', name: '小明' }} onSubmitted={vi.fn()} /></MemoryRouter>);

describe('題庫設定與伺服器一致（parity）', () => {
  it('構面 id、名稱、順序與課前評測一致，B 題編號與伺服器的構面對應一致', () => {
    expect(config.DIMENSIONS.map((d) => d.id)).toEqual(AI_DIMENSIONS.map((d) => d.id));
    expect(COURSE_DIMENSIONS.map((d) => d.id)).toEqual(AI_DIMENSIONS.map((d) => d.id));
    for (const d of config.DIMENSIONS) {
      const server = COURSE_DIMENSIONS.find((x) => x.id === d.id);
      expect(d.questions.map((q) => q.id), d.id).toEqual(server.items.map((n) => `b${n}`));
      expect(server.name).toBe(AI_DIMENSIONS.find((x) => x.id === d.id).name);
    }
    expect(config.ALL_QUESTIONS).toHaveLength(12);
  });

  it('情境題的題目與伺服器的標準答案一一對應，每題 3 個選項，標準答案是其中一個', () => {
    expect(config.SECTION_C.map((c) => c.id).sort()).toEqual(Object.keys(SJT_KEY).sort());
    for (const c of config.SECTION_C) {
      expect(c.options.map((o) => o.id)).toEqual(['a', 'b', 'c']);
      expect(c.options.map((o) => o.id)).toContain(SJT_KEY[c.id]);
      expect(c.explain.length).toBeGreaterThan(10);
    }
  });

  it('標準答案不在前端題庫設定裡（只有解析文字）', () => {
    const json = JSON.stringify(config);
    expect(json).not.toMatch(/correct|answerKey|SJT_KEY/i);
  });

  it('阻礙選項、單元數、必填數與伺服器一致', () => {
    expect(config.SECTION_D.barriers.map((b) => b.id)).toEqual(BARRIER_CODES);
    expect(config.SECTION_A.modules).toHaveLength(MODULE_COUNT);
    expect(config.TOTAL_QUESTIONS).toBe(serverRequiredKeys().length);
  });

  it('已註冊、標記為班級限定，且不是 360° 評測', () => {
    const cfg = getAssessment('ai-course-post');
    expect(cfg.CLASS_ONLY).toBe(true);
    expect(cfg.SUPPORTS_360).toBe(false);
    expect(cfg.LEVELS[0].min).toBeLessThanOrEqual(cfg.MIN_SCORE);
  });
});

describe('作答畫面', () => {
  it('顯示各部分；沒答完送出會標示未答題並且不呼叫 API', async () => {
    m.mySubmissions.mockResolvedValue([]);
    renderSurvey();
    expect(await screen.findByText('A 課程體驗')).toBeInTheDocument();
    expect(screen.getByText('B 我學到了什麼：課前的我 vs 現在的我')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '送出問卷' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('還有 50 題沒有作答');
    expect(m.createSubmission).not.toHaveBeenCalled();
  });

  it('填完才送出；送出只帶答案、不帶前端算的結果；顯示伺服器的結果', async () => {
    m.mySubmissions.mockResolvedValue([]);
    const result = buildCourseResult(answersFor());
    m.createSubmission.mockResolvedValue({ result });
    renderSurvey();
    await screen.findByText('A 課程體驗');
    fillAll();
    fireEvent.click(screen.getByRole('button', { name: '送出問卷' }));
    expect(await screen.findByText('感謝您的填答')).toBeInTheDocument();
    const payload = m.createSubmission.mock.calls[0][0];
    expect(payload.assessmentId).toBe('ai-course-post');
    expect(payload.result).toBeUndefined();
    expect(payload.answers.b1_now).toBe(4);
    expect(payload.answers.c1).toBe(SJT_KEY.c1);
    expect(localStorage.getItem('aiassess_draft_u1_ai-course-post_v1')).toBeNull();
  });

  it('草稿會保留（重新整理不會全部消失）', async () => {
    m.mySubmissions.mockResolvedValue([]);
    const { unmount } = renderSurvey();
    await screen.findByText('A 課程體驗');
    fireEvent.click(document.querySelector('input[name="a1"][value="5"]'));
    unmount();
    renderSurvey();
    await screen.findByText('A 課程體驗');
    expect(document.querySelector('input[name="a1"][value="5"]')).toBeChecked();
  });

  it('送出失敗（例如不在開放期間）會顯示原因並保留答案', async () => {
    m.mySubmissions.mockResolvedValue([]);
    m.createSubmission.mockRejectedValue(new Error('目前不在開放作答期間'));
    renderSurvey();
    await screen.findByText('A 課程體驗');
    fillAll();
    fireEvent.click(screen.getByRole('button', { name: '送出問卷' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('目前不在開放作答期間');
    expect(document.querySelector('input[name="a1"][value="4"]')).toBeChecked();
  });
});

describe('結果頁', () => {
  const before2 = Object.fromEntries(config.ALL_QUESTIONS.map((q) => [`${q.id}_before`, 2]));
  const doneSub = () => ({ assessmentId: 'ai-course-post', result: buildCourseResult({ ...answersFor(), ...before2, c1: 'a' }), createdAt: new Date().toISOString() });

  it('已交過就直接顯示結果，不再出現表單', async () => {
    m.mySubmissions.mockResolvedValue([doneSub()]);
    renderSurvey();
    expect(await screen.findByText('您已完成這份問卷')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '送出問卷' })).not.toBeInTheDocument();
  });

  it('顯示課前 vs 現在、情境檢核對錯與解析；答錯的題目說明您選的與建議做法', async () => {
    m.mySubmissions.mockResolvedValue([doneSub()]);
    renderSurvey();
    await screen.findByText('您已完成這份問卷');
    expect(screen.getByText(/情境檢核\s+5 \/ 6/)).toBeInTheDocument();
    expect(screen.getByText('您選的：直接請 AI 整理')).toBeInTheDocument();
    expect(screen.getAllByText(/建議做法/)).toHaveLength(6);
    expect(screen.getAllByText('+2').length).toBeGreaterThanOrEqual(6);
  });

  it('有課前評測時多一欄「課前評測」', async () => {
    const pre = { assessmentId: 'ai-competency', raterType: 'self', createdAt: '2026-10-20T00:00:00Z', result: { dimensions: AI_DIMENSIONS.map((d) => ({ id: d.id, average: 3.1 })) } };
    m.mySubmissions.mockResolvedValue([doneSub(), pre]);
    renderSurvey();
    await screen.findByText('您已完成這份問卷');
    expect(screen.getByRole('columnheader', { name: '課前評測' })).toBeInTheDocument();
    expect(screen.getAllByText('3.1').length).toBe(6);
  });

  it('可以撤回追蹤信同意', async () => {
    m.mySubmissions.mockResolvedValue([doneSub()]);
    m.setCourseFollowUp.mockResolvedValue({ followUpConsent: false });
    renderSurvey();
    await screen.findByText('您已完成這份問卷');
    expect(screen.getByText(/已同意/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '撤回同意' }));
    await waitFor(() => expect(m.setCourseFollowUp).toHaveBeenCalledWith(false));
    expect(await screen.findByText(/不寄送/)).toBeInTheDocument();
  });
});

describe('教練端', () => {
  const group = { id: 'g1', name: '韋能班', extraAssessmentIds: ['ai-course-post'] };
  const subs = Array.from({ length: 4 }, (_, i) => ({ answers: { ...answersFor(), e1: `收穫${i}`, d5: ['time'], d6: '' }, createdAt: '2026-10-30T09:00:00Z' }));

  it('沒附加問卷就什麼都不顯示，也不打 API', () => {
    const { container } = render(<CourseSurveyPanel group={{ id: 'g1' }} />);
    expect(container).toBeEmptyDOMElement();
    expect(m.getCourseSurveySummary).not.toHaveBeenCalled();
  });

  it('少於 3 人：只顯示完成率，說明彙總暫不顯示', async () => {
    m.getCourseSurveySummary.mockResolvedValue(summarizeCourseSurvey(subs.slice(0, 2), 4));
    render(<CourseSurveyPanel group={group} />);
    expect(await screen.findByText(/2 \/ 4 人（50%）/)).toBeInTheDocument();
    expect(screen.getByText(/彙總暫不顯示/)).toBeInTheDocument();
    expect(screen.queryByText('整體滿意度（1–5）')).not.toBeInTheDocument();
  });

  it('3 人以上：滿意度、構面進步、答對人數、阻礙與不附姓名的開放題', async () => {
    m.getCourseSurveySummary.mockResolvedValue({ ...summarizeCourseSurvey(subs, 4), followUp: { consented: 4, due30: '2026-11-29', due60: '2026-12-29' } });
    render(<CourseSurveyPanel group={group} />);
    expect(await screen.findByText(/4 \/ 4 人（100%）/)).toBeInTheDocument();
    expect(screen.getByText('整體滿意度（1–5）')).toBeInTheDocument();
    expect(screen.getByText('30 天 2026-11-29／60 天 2026-12-29')).toBeInTheDocument();
    const detail = screen.getByText(/最有價值的收穫（4 則，不附姓名）/).closest('details');
    expect(within(detail).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getAllByText('4 / 4').length).toBeGreaterThanOrEqual(6);
  });

  it('開關：勾選會帶著 extraAssessmentIds 更新班級', async () => {
    m.updateGroup.mockResolvedValue({ ...group, extraAssessmentIds: [] });
    const onUpdated = vi.fn();
    render(<CourseSurveyToggle group={group} onGroupUpdated={onUpdated} showToast={vi.fn()} />);
    const box = screen.getByRole('checkbox', { name: /附加「課後學習成效問卷」/ });
    expect(box).toBeChecked();
    fireEvent.click(box);
    await waitFor(() => expect(m.updateGroup).toHaveBeenCalledWith('g1', { extraAssessmentIds: [] }));
    expect(onUpdated).toHaveBeenCalled();
  });
});

describe('不影響其他畫面（稽核回饋）', () => {
  it('卡片：做完的課後問卷只有「查看我的結果」，沒有「查看分析」與重做', async () => {
    const { default: AssessmentCard } = await import('../survey/components/AssessmentCard.jsx');
    const onStart = vi.fn();
    render(
      <AssessmentCard
        assessment={{ id: 'ai-course-post', name: '課後問卷', description: 'x' }}
        latestSubmission={{ createdAt: '2026-10-30', result: { total: 6, maxScore: 6, level: { badge: '課後問卷已完成', color: '#2c5282' } } }}
        groupPhase={null} submittedPhases={null}
        onStart={onStart} onViewAnalysis={vi.fn()} onGoTo360={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: '查看分析' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /重新作答/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看我的結果' }));
    expect(onStart).toHaveBeenCalledWith('ai-course-post');
  });

  it('「下一步」不會把學員導去課後問卷的（不存在的）分析頁', async () => {
    const { computeNextStep } = await import('../survey/utils/nextStep.js');
    const step = computeNextStep({
      assessments: [{ id: 'ai-competency', name: 'AI', enabled: true }],
      mySubmissions: [
        { assessmentId: 'ai-course-post', raterType: 'self', groupId: null },
        { assessmentId: 'ai-competency', raterType: 'self', groupId: 'g1', phase: 'pre' },
      ],
      myGroups: [], groupMembers: [], goals: [],
    });
    expect(step.kind).toBe('view-report');
    expect(step.assessmentId).toBe('ai-competency');
    const onlyCourse = computeNextStep({
      assessments: [{ id: 'ai-competency', name: 'AI', enabled: true }],
      mySubmissions: [{ assessmentId: 'ai-course-post', raterType: 'self' }], myGroups: [], groupMembers: [], goals: [],
    });
    expect(onlyCourse.kind).toBe('start-any');
  });

  it('班級不在開放期間：填之前就先提醒', async () => {
    m.mySubmissions.mockResolvedValue([]);
    m.myGroups = vi.fn().mockResolvedValue([{ id: 'g1', phase: 'closed', extraAssessmentIds: ['ai-course-post'] }]);
    renderSurvey();
    expect(await screen.findByRole('status')).toHaveTextContent('作答期間已結束');
  });

  it('在別處已經交過（409）：直接顯示結果，不卡在表單上', async () => {
    m.mySubmissions.mockResolvedValueOnce([]);
    m.createSubmission.mockRejectedValue(Object.assign(new Error('已完成作答，不可重複提交'), { code: 'ALREADY_SUBMITTED' }));
    renderSurvey();
    await screen.findByText('A 課程體驗');
    fillAll();
    m.mySubmissions.mockResolvedValue([{ assessmentId: 'ai-course-post', result: buildCourseResult(answersFor()), createdAt: new Date().toISOString() }]);
    fireEvent.click(screen.getByRole('button', { name: '送出問卷' }));
    expect(await screen.findByText('您已完成這份問卷')).toBeInTheDocument();
  });
});

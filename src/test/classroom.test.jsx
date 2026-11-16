import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildClassroomSummary, classroomOutline, MIN_CLASSROOM } from '../survey/utils/classroom.js';
import ClassroomMode from '../survey/coach/ClassroomMode.jsx';
import { ToastProvider } from '../survey/components/Toast';

const dims = [
  { id: 'communication', name: '溝通力', subtitle: 'Communication', color: '#2563eb', percent: 82 },
  { id: 'collaboration', name: '建立關係', subtitle: 'Collaboration', color: '#16a34a', percent: 74 },
  { id: 'task-management', name: '任務管理', subtitle: 'Task Management', color: '#ea580c', percent: 58 },
  { id: 'execution', name: '執行力', subtitle: 'Execution', color: '#db2777', percent: 66 },
  { id: 'leadership-impact', name: '領導影響力', subtitle: 'Leadership Impact', color: '#7c3aed', percent: 71 },
  { id: 'developing-others', name: '人才發展', subtitle: 'Developing Others', color: '#0d9488', percent: 49 },
];
const levels = [
  { id: 'a', badge: '探索期', color: '#94a3b8', count: 1 },
  { id: 'b', badge: '發展期', color: '#60a5fa', count: 5 },
  { id: 'c', badge: '精熟期', color: '#34d399', count: 4 },
];
const stats = (respondents) => ({ respondents, avgTotal: 300, avgPercent: 68, dimensionAverages: dims, levelDistribution: levels });

describe('課堂模式：彙總與隱私', () => {
  it('完成人數少於 3：不給任何數字', () => {
    expect(MIN_CLASSROOM).toBe(3);
    for (const n of [0, 1, 2]) {
      const s = buildClassroomSummary(stats(n), 'leadership-9d');
      expect(s.available).toBe(false);
      expect(Object.keys(s)).toEqual(['available', 'respondents', 'reason']);
      expect(classroomOutline('班', s)).toBe('');
    }
  });

  it('3 位以上：強弱各 3 個、依百分比排序、不重疊；討論題針對最弱構面', () => {
    const s = buildClassroomSummary(stats(10), 'leadership-9d');
    expect(s.available).toBe(true);
    expect(s.strongest.map((d) => d.label)).toEqual(['溝通力', '建立關係', '領導影響力']);
    expect(s.weakest.map((d) => d.label)).toEqual(['人才發展', '任務管理', '執行力']);
    expect(s.prompts[0]).toMatchObject({ dimension: '人才發展' });
    expect(s.prompts[0].question).toContain('「人才發展」');
    expect(s.prompts[0].activity.length).toBeGreaterThan(0);
    expect(s.levelDistribution.map((l) => l.share)).toEqual([10, 50, 40]);
  });

  it('風格輪廓型題庫（沒有優劣）：不排強弱與討論題', () => {
    const s = buildClassroomSummary(stats(10), 'disc', { profileMode: true });
    expect(s.strongest).toEqual([]);
    expect(s.weakest).toEqual([]);
    expect(s.prompts).toEqual([]);
  });

  it('講義大綱只有彙總，沒有姓名欄位', () => {
    const text = classroomOutline('領導力班', buildClassroomSummary(stats(10), 'leadership-9d'));
    expect(text).toContain('領導力班');
    expect(text).toContain('人才發展（49%）');
    expect(text).toContain('活動建議：');
  });
});

describe('ClassroomMode 畫面', () => {
  const group = { id: 'g1', name: '示範班', assessmentId: 'leadership-9d' };
  const renderIt = (n, onClose = vi.fn()) => render(<ToastProvider><ClassroomMode group={group} groupStats={stats(n)} onClose={onClose} /></ToastProvider>);

  it('人數足夠：顯示雷達圖、優勢、落點與討論題；Esc 離開', () => {
    const onClose = vi.fn();
    renderIt(10, onClose);
    expect(screen.getByRole('dialog', { name: '課堂模式' })).toBeInTheDocument();
    expect(screen.getByText('示範班')).toBeInTheDocument();
    expect(screen.getByText(/10 位同學完成/)).toBeInTheDocument();
    expect(screen.getByLabelText('討論題')).toBeInTheDocument();
    expect(screen.getByLabelText('班級整體能力雷達')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('人數不足：只有說明，沒有圖也沒有任何數字', () => {
    renderIt(2);
    expect(screen.getByRole('status')).toHaveTextContent('至少要有 3 位同學完成');
    expect(screen.queryByLabelText('班級整體能力雷達')).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByRole('button', { name: /複製討論大綱/ })).toBeNull();
  });
});

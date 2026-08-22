import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JourneyTimeline from '../survey/components/JourneyTimeline';
import { buildJourneyNarrative } from '../survey/utils/narrative';

const level = (badge) => ({ badge, color: '#333' });

function sub(id, total, createdAt, extra = {}) {
  return {
    id,
    createdAt,
    result: {
      total,
      percent: Math.round((total / 185) * 100),
      assessmentName: 'AI 全方位職能實戰課前評測',
      level: level('📈 AI 應用實踐者'),
      dimensions: [
        { id: 'foundation', subtitle: '基礎力', name: '工具認知', score: extra.foundation ?? 20, max: 30 },
        { id: 'safety', subtitle: '安全思維力', name: '風險管理', score: extra.safety ?? 20, max: 35 },
      ],
    },
    ...extra,
  };
}

describe('buildJourneyNarrative', () => {
  it('沒有資料時回傳空字串', () => {
    expect(buildJourneyNarrative([])).toBe('');
    expect(buildJourneyNarrative(null)).toBe('');
  });

  it('只有一筆時說明這是起點，不報成長幅度', () => {
    const text = buildJourneyNarrative([sub('a', 111, '2026-01-01T00:00:00Z')]);
    expect(text).toContain('111');
    // 只有一次作答無從比較，不應出現「成長 N 分 / 下滑 N 分」這種幅度描述
    expect(text).not.toMatch(/成長 \d+ 分/);
    expect(text).not.toMatch(/下滑 \d+ 分/);
  });

  it('多筆時說出累積次數與總成長幅度', () => {
    // 陣列為新到舊排序
    const text = buildJourneyNarrative([
      sub('c', 161, '2026-03-01T00:00:00Z'),
      sub('b', 130, '2026-02-01T00:00:00Z'),
      sub('a', 111, '2026-01-01T00:00:00Z'),
    ]);
    expect(text).toContain('3 次');
    expect(text).toContain('161');
    expect(text).toContain('111');
    expect(text).toContain('成長 50');
  });

  it('分數退步時用「下滑」而非「成長」', () => {
    const text = buildJourneyNarrative([
      sub('b', 90, '2026-02-01T00:00:00Z'),
      sub('a', 120, '2026-01-01T00:00:00Z'),
    ]);
    expect(text).toContain('下滑 30');
    expect(text).not.toContain('成長 30');
  });

  it('指出進步最多的構面', () => {
    const text = buildJourneyNarrative([
      sub('b', 161, '2026-02-01T00:00:00Z', { foundation: 22, safety: 33 }),
      sub('a', 111, '2026-01-01T00:00:00Z', { foundation: 20, safety: 15 }),
    ]);
    // 安全思維力 +18 > 基礎力 +2
    expect(text).toContain('安全思維力');
  });

  it('同一組資料重複呼叫得到相同結果（報告內容需穩定）', () => {
    const data = [
      sub('b', 161, '2026-02-01T00:00:00Z'),
      sub('a', 111, '2026-01-01T00:00:00Z'),
    ];
    expect(buildJourneyNarrative(data)).toBe(buildJourneyNarrative(data));
  });
});

describe('JourneyTimeline', () => {
  const submissions = [
    sub('c', 161, '2026-03-01T00:00:00Z', { phase: 'post' }),
    sub('a', 111, '2026-01-01T00:00:00Z', { phase: 'pre' }),
  ];

  it('沒有作答紀錄時不渲染', () => {
    const { container } = render(<JourneyTimeline narrative="" submissions={[]} onSelect={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('顯示敘事、每筆分數與課前課後標記', () => {
    render(<JourneyTimeline narrative="這是一段敘事" submissions={submissions} onSelect={() => {}} />);
    expect(screen.getByText('這是一段敘事')).toBeInTheDocument();
    expect(screen.getByText('161')).toBeInTheDocument();
    expect(screen.getByText('111')).toBeInTheDocument();
    expect(screen.getByText('課前')).toBeInTheDocument();
    expect(screen.getByText('課後')).toBeInTheDocument();
  });

  it('標示與前一次相比的漲跌，並把最早一筆標為起點', () => {
    render(<JourneyTimeline narrative="" submissions={submissions} onSelect={() => {}} />);
    expect(screen.getByText('▲ +50')).toBeInTheDocument();
    expect(screen.getByText('起點')).toBeInTheDocument();
  });

  it('點任一節點會帶出該筆的 id，而不是永遠回傳最新一筆', () => {
    const onSelect = vi.fn();
    render(<JourneyTimeline narrative="" submissions={submissions} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('111').closest('button'));
    expect(onSelect).toHaveBeenCalledWith('a');

    fireEvent.click(screen.getByText('161').closest('button'));
    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('只有一筆時不顯示漲跌與起點標記', () => {
    render(<JourneyTimeline narrative="" submissions={[submissions[0]]} onSelect={() => {}} />);
    expect(screen.queryByText('起點')).not.toBeInTheDocument();
    expect(screen.queryByText(/▲|▽/)).not.toBeInTheDocument();
  });
});

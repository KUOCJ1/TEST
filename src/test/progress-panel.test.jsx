import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProgressPanel from '../survey/coach/ProgressPanel';

const group = { id: 'g1', name: '2026 秋季班', memberIds: ['u1', 'u2', 'u3'], endDate: '2026-12-31T00:00:00Z', joinCode: 'ABC123' };
const members = [
  { id: 'u1', name: '小明', email: 'ming@x.com' },
  { id: 'u2', name: '小華', email: 'hua@x.com' },
  { id: 'u3', name: '小美', email: 'mei@x.com' },
];

function sub(userId, phase) {
  return { userId, raterType: 'self', phase };
}

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue() } });
});

describe('ProgressPanel', () => {
  it('顯示課前／課後完成人數', () => {
    const submissions = [sub('u1', 'pre'), sub('u1', 'post'), sub('u2', 'pre')];
    render(<ProgressPanel group={group} members={members} submissions={submissions} />);
    const preBlock = screen.getByText('課前').closest('div');
    const postBlock = screen.getByText('課後').closest('div');
    expect(preBlock).toHaveTextContent('2');
    expect(preBlock).toHaveTextContent('/ 3');
    expect(postBlock).toHaveTextContent('1');
    expect(postBlock).toHaveTextContent('/ 3');
  });

  it('列出課前未完成的成員', () => {
    const submissions = [sub('u1', 'pre')];
    render(<ProgressPanel group={group} members={members} submissions={submissions} />);
    expect(screen.getByText('課前未完成（2）')).toBeInTheDocument();
    expect(screen.getByText('小華')).toBeInTheDocument();
    expect(screen.getByText('小美')).toBeInTheDocument();
  });

  it('課前完成但課後未完成的人只出現在課後未完成名單，不會同時出現在課前名單', () => {
    const submissions = [sub('u1', 'pre')];
    render(<ProgressPanel group={group} members={members} submissions={submissions} />);
    const preSection = screen.getByText('課前未完成（2）').closest('div');
    expect(preSection).not.toHaveTextContent('小明');
    expect(screen.getByText('課後未完成（1）')).toBeInTheDocument();
  });

  it('全部完成時顯示恭喜訊息，不顯示未完成名單', () => {
    const submissions = [sub('u1', 'pre'), sub('u1', 'post'), sub('u2', 'pre'), sub('u2', 'post'), sub('u3', 'pre'), sub('u3', 'post')];
    render(<ProgressPanel group={group} members={members} submissions={submissions} />);
    expect(screen.getByText(/所有成員都已完成評測/)).toBeInTheDocument();
    expect(screen.queryByText(/未完成/)).not.toBeInTheDocument();
  });

  it('複製提醒訊息會把班名、截止日、報到連結一起複製', async () => {
    const submissions = [sub('u1', 'pre')];
    render(<ProgressPanel group={group} members={members} submissions={submissions} />);
    fireEvent.click(screen.getByRole('button', { name: /複製提醒訊息/ }));
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    const text = navigator.clipboard.writeText.mock.calls[0][0];
    expect(text).toContain('2026 秋季班');
    expect(text).toContain('ABC123');
    expect(text).toContain('尚未完成課前評測');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuestionCard from '../survey/components/QuestionCard';

// Sprint 8 驗收條件 8.5。
const q = { id: 'q1', text: '我能清楚表達想法' };

describe('QuestionCard', () => {
  it('5 個選項各自保留完整標籤給螢幕報讀器（手機只在兩端顯示文字）', () => {
    render(<QuestionCard number={1} question={q} value="" onChange={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(screen.getByRole('radio', { name: /1\s*非常不同意/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /5\s*非常同意/ })).toBeInTheDocument();
  });

  it('第一次作答會帶到下一題；回頭改答案則不跳走', () => {
    const onChange = vi.fn();
    const onAdvance = vi.fn();
    const { rerender } = render(<QuestionCard number={1} question={q} value="" onChange={onChange} onAdvance={onAdvance} />);
    fireEvent.click(screen.getByRole('radio', { name: /4/ }));
    expect(onChange).toHaveBeenCalledWith('q1', 4);
    expect(onAdvance).toHaveBeenCalledWith('q1');

    rerender(<QuestionCard number={1} question={q} value={4} onChange={onChange} onAdvance={onAdvance} />);
    fireEvent.click(screen.getByRole('radio', { name: /2/ }));
    expect(onChange).toHaveBeenLastCalledWith('q1', 2);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('按數字鍵作答並以鍵盤模式前進（會移動焦點）', () => {
    const onChange = vi.fn();
    const onAdvance = vi.fn();
    const { container } = render(<QuestionCard number={1} question={q} value="" onChange={onChange} onAdvance={onAdvance} />);
    fireEvent.keyDown(container.querySelector('fieldset'), { key: '3' });
    expect(onChange).toHaveBeenCalledWith('q1', 3);
    expect(onAdvance).toHaveBeenCalledWith('q1', { viaKeyboard: true });
  });
});

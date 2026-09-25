import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommentEditor from '../survey/coach/CommentEditor';

const { upsertComment } = vi.hoisted(() => ({ upsertComment: vi.fn() }));
vi.mock('../survey/api/client', () => ({ api: { upsertComment } }));

const submission = {
  id: 's1',
  result: {
    strongest: { id: 'a', subtitle: '溝通力' },
    weakest: { id: 'b', subtitle: '執行力' },
  },
};

beforeEach(() => {
  localStorage.clear();
  upsertComment.mockReset();
  upsertComment.mockResolvedValue({ id: 'c1', text: 'saved', tips: [] });
});

describe('CommentEditor', () => {
  it('可以快速插入最強／待強化構面名稱', () => {
    render(<CommentEditor submission={submission} onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /最強：溝通力/ }));
    fireEvent.click(screen.getByRole('button', { name: /待強化：執行力/ }));
    expect(screen.getByPlaceholderText('針對此學員的整體觀察與評語…')).toHaveValue('「溝通力」「執行力」');
  });

  it('可以把目前內容另存為範本，並在下一次掛載時看到它', async () => {
    const { unmount } = render(<CommentEditor submission={submission} onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('針對此學員的整體觀察與評語…'), { target: { value: '固定開場白：整體表現穩健。' } });
    fireEvent.click(screen.getByRole('button', { name: /另存為範本/ }));
    fireEvent.change(screen.getByPlaceholderText('範本名稱'), { target: { value: '穩健開場' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));

    unmount();
    render(<CommentEditor submission={{ ...submission, id: 's2' }} onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('option', { name: '穩健開場' })).toBeInTheDocument();
  });

  it('套用範本會覆蓋目前的文字與建議', () => {
    localStorage.setItem('aiassess_comment_templates_v1', JSON.stringify([
      { id: 'tpl1', name: '範本一', text: '範本內容', tips: ['建議A', '建議B'] },
    ]));
    render(<CommentEditor submission={submission} onSaved={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tpl1' } });
    fireEvent.click(screen.getByRole('button', { name: '套用' }));

    expect(screen.getByPlaceholderText('針對此學員的整體觀察與評語…')).toHaveValue('範本內容');
    expect(screen.getByPlaceholderText('建議 1')).toHaveValue('建議A');
    expect(screen.getByPlaceholderText('建議 2')).toHaveValue('建議B');
  });

  it('可以刪除範本', () => {
    localStorage.setItem('aiassess_comment_templates_v1', JSON.stringify([
      { id: 'tpl1', name: '要刪除的範本', text: 'x', tips: [] },
    ]));
    render(<CommentEditor submission={submission} onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tpl1' } });
    fireEvent.click(screen.getByRole('button', { name: '刪除範本' }));
    expect(screen.queryByRole('option', { name: '要刪除的範本' })).not.toBeInTheDocument();
  });

  it('儲存評語仍正常運作（既有行為不受範本功能影響）', async () => {
    const onSaved = vi.fn();
    render(<CommentEditor submission={submission} onSaved={onSaved} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('針對此學員的整體觀察與評語…'), { target: { value: '很棒' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存評語' }));
    await vi.waitFor(() => expect(upsertComment).toHaveBeenCalledWith('s1', { text: '很棒', tips: [] }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});

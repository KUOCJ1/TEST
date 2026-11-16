import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CommentEditor from '../survey/coach/CommentEditor';
import { DRAFT_MARKER } from '../survey/utils/commentDraft.js';

const { upsertComment, store, commentTemplates, saveCommentTemplates } = vi.hoisted(() => {
  const store = { list: [] };
  return {
    store,
    upsertComment: vi.fn(),
    commentTemplates: vi.fn(async () => store.list),
    saveCommentTemplates: vi.fn(async (list) => { store.list = list.map((t, i) => ({ id: t.id ?? `t${i}`, ...t })); return store.list; }),
  };
});
vi.mock('../survey/api/client', () => ({ api: { upsertComment, commentTemplates, saveCommentTemplates, rateeSubmissions: vi.fn().mockResolvedValue([]) } }));

const submission = {
  id: 's1',
  assessmentId: 'leadership-9d',
  result: {
    assessmentId: 'leadership-9d',
    strongest: { id: 'a', subtitle: '溝通力' },
    weakest: { id: 'b', subtitle: '執行力' },
    dimensions: [
      { id: 'communication', name: '溝通力', subtitle: 'Communication', average: 4.6 },
      { id: 'collaboration', name: '協作關係', subtitle: 'Collaboration', average: 4.1 },
      { id: 'execution', name: '執行力', subtitle: 'Execution', average: 2.4 },
    ],
  },
};
const box = () => screen.getByPlaceholderText('針對此學員的整體觀察與評語…');

beforeEach(() => {
  localStorage.clear();
  store.list = [];
  upsertComment.mockReset();
  upsertComment.mockResolvedValue({ id: 'c1', text: 'saved', tips: [] });
  commentTemplates.mockClear();
  saveCommentTemplates.mockClear();
});

describe('CommentEditor', () => {
  it('可以快速插入最強／待強化構面名稱', () => {
    render(<CommentEditor submission={submission} onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /最強：溝通力/ }));
    fireEvent.click(screen.getByRole('button', { name: /待強化：執行力/ }));
    expect(box()).toHaveValue('「溝通力」「執行力」');
  });

  it('範本存到伺服器（帳號），下一次掛載時載入', async () => {
    const { unmount } = render(<CommentEditor submission={submission} onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(box(), { target: { value: '固定開場白：整體表現穩健。' } });
    fireEvent.click(screen.getByRole('button', { name: /另存為範本/ }));
    fireEvent.change(screen.getByPlaceholderText('範本名稱'), { target: { value: '穩健開場' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));
    await waitFor(() => expect(saveCommentTemplates).toHaveBeenCalled());
    expect(saveCommentTemplates.mock.calls[0][0][0]).toMatchObject({ name: '穩健開場', text: '固定開場白：整體表現穩健。' });

    unmount();
    render(<CommentEditor submission={{ ...submission, id: 's2' }} onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(await screen.findByRole('option', { name: '穩健開場' })).toBeInTheDocument();
  });

  it('套用範本會覆蓋目前的文字與建議', async () => {
    store.list = [{ id: 'tpl1', name: '範本一', text: '範本內容', tips: ['建議A', '建議B'] }];
    render(<CommentEditor submission={submission} onSaved={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByRole('option', { name: '範本一' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tpl1' } });
    fireEvent.click(screen.getByRole('button', { name: '套用' }));
    expect(box()).toHaveValue('範本內容');
    expect(screen.getByPlaceholderText('建議 1')).toHaveValue('建議A');
    expect(screen.getByPlaceholderText('建議 2')).toHaveValue('建議B');
  });

  it('可以刪除範本（同步到伺服器）', async () => {
    store.list = [{ id: 'tpl1', name: '要刪除的範本', text: 'x', tips: [] }];
    render(<CommentEditor submission={submission} onSaved={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByRole('option', { name: '要刪除的範本' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tpl1' } });
    fireEvent.click(screen.getByRole('button', { name: '刪除範本' }));
    await waitFor(() => expect(saveCommentTemplates).toHaveBeenCalledWith([]));
    expect(screen.queryByRole('option', { name: '要刪除的範本' })).not.toBeInTheDocument();
  });

  it('伺服器沒有範本、本機有舊範本：提示一鍵匯入', async () => {
    localStorage.setItem('aiassess_comment_templates_v1', JSON.stringify([{ id: 'old1', name: '舊範本', text: '舊內容', tips: [] }]));
    render(<CommentEditor submission={submission} onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: '匯入到我的帳號' }));
    await waitFor(() => expect(saveCommentTemplates).toHaveBeenCalled());
    expect(saveCommentTemplates.mock.calls[0][0][0].name).toBe('舊範本');
    expect(localStorage.getItem('aiassess_comment_templates_v1')).toBeNull();
  });

  it('儲存評語仍正常運作', async () => {
    const onSaved = vi.fn();
    render(<CommentEditor submission={submission} onSaved={onSaved} onCancel={vi.fn()} />);
    fireEvent.change(box(), { target: { value: '很棒' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存評語' }));
    await waitFor(() => expect(upsertComment).toHaveBeenCalledWith('s1', { text: '很棒', tips: [] }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});

describe('評語草稿（Sprint 28）', () => {
  it('帶入草稿：肯定導向，提到優勢與待加強構面，附兩個行動；有內容時先確認才覆蓋', async () => {
    render(<CommentEditor submission={submission} onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '帶入草稿' }));
    await waitFor(() => expect(box().value).toContain(DRAFT_MARKER));
    expect(box().value).toContain('溝通力');
    expect(box().value).toContain('執行力');
    expect(screen.getByPlaceholderText('建議 1').value).not.toBe('');
    expect(screen.getByPlaceholderText('建議 2').value).not.toBe('');
    // 已有內容 → 先問
    fireEvent.change(box(), { target: { value: '我自己寫的' } });
    fireEvent.click(screen.getByRole('button', { name: '帶入草稿' }));
    expect(screen.getByText(/會覆蓋目前的內容/)).toBeInTheDocument();
    expect(box()).toHaveValue('我自己寫的');
    fireEvent.click(screen.getByText(/會覆蓋目前的內容/).querySelector('button.btn-ghost'));
    expect(screen.queryByText(/會覆蓋目前的內容/)).not.toBeInTheDocument();
    expect(box()).toHaveValue('我自己寫的');
  });

  it('草稿標示沒刪掉就不能儲存（避免不改就送出）', async () => {
    render(<CommentEditor submission={submission} onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '帶入草稿' }));
    await waitFor(() => expect(box().value).toContain(DRAFT_MARKER));
    fireEvent.click(screen.getByRole('button', { name: '儲存評語' }));
    expect(await screen.findByText(/這是系統草稿/)).toBeInTheDocument();
    expect(upsertComment).not.toHaveBeenCalled();
    fireEvent.change(box(), { target: { value: box().value.replace(DRAFT_MARKER, '').trim() } });
    fireEvent.click(screen.getByRole('button', { name: '儲存評語' }));
    await waitFor(() => expect(upsertComment).toHaveBeenCalled());
  });
});

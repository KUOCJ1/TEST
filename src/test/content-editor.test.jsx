import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ContentEditorTab from '../survey/admin/ContentEditorTab';
import { ConfirmProvider } from '../survey/components/ConfirmDialog';
import { ToastProvider } from '../survey/components/Toast';
import { REGISTRY } from '../survey/data/assessments/index.js';
import { applyContentOverrides } from '../survey/data/assessments/overrides.js';
import { setEdit, getEdit, countEdits, sameEdits, findOverLimit, emptyEdits } from '../survey/admin/contentEdits.js';

// Sprint 10 驗收條件 10.3／10.4：管理後台「題庫內容」編輯器。

const { getContent, saveDraft, discardDraft, publish, rollback, contentApi } = vi.hoisted(() => ({
  getContent: vi.fn(), saveDraft: vi.fn(), discardDraft: vi.fn(), publish: vi.fn(), rollback: vi.fn(), contentApi: vi.fn(),
}));
vi.mock('../survey/api/client', () => ({
  api: {
    adminAssessmentContent: getContent,
    adminSaveContentDraft: saveDraft,
    adminDiscardContentDraft: discardDraft,
    adminPublishContent: publish,
    adminRollbackContent: rollback,
    assessmentContent: contentApi,
  },
}));

const FIRST = REGISTRY['ai-competency'];
const q1 = FIRST.DIMENSIONS[0].questions[0];
const rec = (over = {}) => ({ id: 'ai-competency', draft: null, published: null, history: [], ...over });

function renderEditor() {
  return render(
    <ToastProvider><ConfirmProvider><ContentEditorTab /></ConfirmProvider></ToastProvider>,
  );
}
const questionBox = () => screen.getByLabelText('第 1 題');

beforeEach(() => {
  [getContent, saveDraft, discardDraft, publish, rollback, contentApi].forEach((m) => m.mockReset());
  contentApi.mockResolvedValue({});
  getContent.mockResolvedValue(rec());
  sessionStorage.clear();
  applyContentOverrides({});
});
afterEach(() => applyContentOverrides({}));

describe('contentEdits 純函式', () => {
  it('setEdit：改成與內建相同或清空＝移除覆寫；questions 與其他群組格式不同', () => {
    let e = setEdit(emptyEdits(), 'questions', 'q1', null, '新', '舊');
    expect(getEdit(e, 'questions', 'q1')).toBe('新');
    e = setEdit(e, 'dimensions', 'd1', 'name', '名', '舊名');
    expect(getEdit(e, 'dimensions', 'd1', 'name')).toBe('名');
    expect(countEdits(e)).toBe(2);
    e = setEdit(e, 'questions', 'q1', null, '舊', '舊');
    e = setEdit(e, 'dimensions', 'd1', 'name', '   ', '舊名');
    expect(countEdits(e)).toBe(0);
    expect(e.dimensions).toEqual({});
  });
  it('sameEdits 不在乎 key 順序與空群組；findOverLimit 抓超過字數', () => {
    expect(sameEdits({ questions: { a: 'x', b: 'y' } }, { questions: { b: 'y', a: 'x' }, levels: {} })).toBe(true);
    expect(sameEdits({ questions: { a: 'x' } }, {})).toBe(false);
    expect(findOverLimit({ questions: { q1: 'a'.repeat(201) } })).toMatch(/q1/);
    expect(findOverLimit({ questions: { q1: 'a'.repeat(200) } })).toBeNull();
    expect(findOverLimit({ dimensions: { d: { name: 'a'.repeat(41) } } })).toBeTruthy();
  });
});

describe('ContentEditorTab', () => {
  it('載入後顯示內建文字、目前生效為內建原文；說明不能改的項目', async () => {
    renderEditor();
    await waitFor(() => expect(questionBox()).toHaveValue(q1.text));
    expect(screen.getByText(/內建原文（還沒有發佈過任何修改）/)).toBeInTheDocument();
    expect(screen.getByText(/不能在這裡修改/)).toBeInTheDocument();
    expect(screen.getByText(/反向題/, { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '儲存草稿' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '發佈…' })).toBeDisabled();
  });

  it('反向題標示在題號上，提醒管理者維持反向語意', async () => {
    renderEditor();
    await waitFor(() => expect(questionBox()).toBeInTheDocument());
    const reversedIdx = FIRST.ALL_QUESTIONS.findIndex((q) => q.reversed) + 1;
    expect(screen.getByLabelText(`第 ${reversedIdx} 題（反向題）`)).toBeInTheDocument();
  });

  it('修改後顯示「已修改」、內建原文與可單欄還原；儲存草稿送出完整覆寫', async () => {
    saveDraft.mockImplementation((id, overrides) => Promise.resolve(rec({ draft: { overrides, updatedAt: new Date().toISOString() } })));
    renderEditor();
    await waitFor(() => expect(questionBox()).toHaveValue(q1.text));
    fireEvent.change(questionBox(), { target: { value: '改過的第一題' } });
    expect(screen.getAllByText('已修改').length).toBeGreaterThan(0);
    expect(screen.getByText(q1.text, { selector: 'p' })).toHaveTextContent(`內建原文：${q1.text}`);
    expect(screen.getByText(/尚未儲存的編輯/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '儲存草稿' }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalledWith('ai-competency', expect.objectContaining({ questions: { [q1.id]: '改過的第一題' } })));
    await waitFor(() => expect(screen.getByRole('button', { name: '發佈…' })).toBeEnabled());
    // 單欄還原
    fireEvent.click(screen.getByRole('button', { name: /還原原文/ }));
    expect(questionBox()).toHaveValue(q1.text);
  });

  it('超過字數上限時不能儲存，並提示', async () => {
    renderEditor();
    await waitFor(() => expect(questionBox()).toHaveValue(q1.text));
    fireEvent.change(questionBox(), { target: { value: 'a'.repeat(201) } });
    expect(screen.getByRole('button', { name: '儲存草稿' })).toBeDisabled();
    expect(screen.getByText(/超過字數上限/)).toBeInTheDocument();
  });

  it('發佈：要有備註才能確認；成功後重新載入已發佈內容', async () => {
    const draft = { overrides: { questions: { [q1.id]: '草稿題' } }, updatedAt: new Date().toISOString() };
    getContent.mockResolvedValue(rec({ draft }));
    publish.mockResolvedValue(rec({ published: { version: 1, overrides: draft.overrides, publishedAt: new Date().toISOString(), publishedByName: '管理員', note: '修題' }, history: [{ version: 1, kind: 'publish', note: '修題', publishedAt: new Date().toISOString(), publishedByName: '管理員' }] }));
    renderEditor();
    await waitFor(() => expect(questionBox()).toHaveValue('草稿題'));
    fireEvent.click(screen.getByRole('button', { name: '發佈…' }));
    const confirmBtn = screen.getByRole('button', { name: '確認發佈' });
    expect(confirmBtn).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/發佈備註/), { target: { value: '修題' } });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(publish).toHaveBeenCalledWith('ai-competency', '修題'));
    await waitFor(() => expect(screen.getByText(/版本 1（/)).toBeInTheDocument());
  });

  it('歷史：列出版本、目前生效標記；還原需確認，且以版本號呼叫 API', async () => {
    const mk = (v, kind = 'publish') => ({ version: v, kind, note: `備註${v}`, publishedAt: new Date().toISOString(), publishedByName: '管理員', overrides: {} });
    getContent.mockResolvedValue(rec({ published: mk(2), history: [mk(2), mk(1)] }));
    rollback.mockResolvedValue(rec({ published: mk(3, 'rollback'), history: [mk(3, 'rollback'), mk(2), mk(1)] }));
    renderEditor();
    await waitFor(() => expect(screen.getByText('目前生效')).toBeInTheDocument());
    fireEvent.click(screen.getByText('發佈歷史'));
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).queryByRole('button', { name: '還原到此版本' })).not.toBeInTheDocument(); // 目前生效的不能還原
    fireEvent.click(within(items[1]).getByRole('button', { name: '還原到此版本' }));
    fireEvent.click(await screen.findByRole('button', { name: '還原' }));
    await waitFor(() => expect(rollback).toHaveBeenCalledWith('ai-competency', 1));
  });

  it('預覽：有未存檔的編輯會先存草稿，再把草稿套用到畫面', async () => {
    saveDraft.mockImplementation((id, overrides) => Promise.resolve(rec({ draft: { overrides, updatedAt: new Date().toISOString() } })));
    renderEditor();
    await waitFor(() => expect(questionBox()).toHaveValue(q1.text));
    fireEvent.change(questionBox(), { target: { value: '預覽用題目' } });
    fireEvent.click(screen.getByRole('button', { name: '預覽草稿' }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalled());
  });

  it('未存檔的編輯暫存在 sessionStorage，重新進入時還原並提示', async () => {
    sessionStorage.setItem('content-edits:ai-competency', JSON.stringify({ questions: { [q1.id]: '上次寫到一半' } }));
    renderEditor();
    await waitFor(() => expect(questionBox()).toHaveValue('上次寫到一半'));
    expect(screen.getByText(/已還原你上次尚未儲存的編輯/)).toBeInTheDocument();
  });

  it('風格型題庫（DISC）不顯示等級說明編輯區', async () => {
    getContent.mockResolvedValue({ id: 'disc', draft: null, published: null, history: [] });
    renderEditor();
    await waitFor(() => expect(questionBox()).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('選擇題庫'), { target: { value: 'disc' } });
    await waitFor(() => expect(getContent).toHaveBeenCalledWith('disc'));
    await waitFor(() => expect(screen.queryByText('落點等級說明')).not.toBeInTheDocument());
  });

  it('載入失敗顯示錯誤', async () => {
    getContent.mockRejectedValue(new Error('載入壞了'));
    renderEditor();
    expect(await screen.findByRole('alert')).toHaveTextContent('載入壞了');
  });
});

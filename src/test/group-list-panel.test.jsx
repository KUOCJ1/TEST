import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GroupListPanel from '../survey/coach/GroupListPanel';
import { REGISTRY } from '../survey/data/assessments/index.js';

// 建立班別時，評量下拉選單要能選到所有（已啟用的）題庫——以前只會列出「現有班別
// 用過的題庫」，教練第一次建班或只用過 AI 職能時，其他題庫永遠選不到。

const { assessments, createGroup } = vi.hoisted(() => ({ assessments: vi.fn(), createGroup: vi.fn() }));
vi.mock('../survey/api/client', () => ({ api: { assessments, createGroup, deleteGroup: vi.fn() } }));

// 班級限定的問卷（CLASS_ONLY）不能當班級的主要評量，不在建班選項裡。
const ALL = Object.keys(REGISTRY).filter((id) => !REGISTRY[id].CLASS_ONLY);
const asList = (ids) => ids.map((id) => ({ id, name: id, enabled: true }));
const group = (over = {}) => ({ id: 'g1', name: '現有班', assessmentId: 'ai-competency', memberIds: [], phase: 'not_started', ...over });

function renderPanel(groups = []) {
  const props = { groups, setGroups: vi.fn(), selectedGroupId: null, onSelectGroup: vi.fn(), onGroupDeleted: vi.fn(), showToast: vi.fn(), confirm: vi.fn(), onCompareCohorts: vi.fn() };
  render(<GroupListPanel {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /建立班別/ }));
  return props;
}
const options = () => screen.getAllByRole('option').map((o) => o.value);

beforeEach(() => {
  assessments.mockReset();
  createGroup.mockReset();
  assessments.mockResolvedValue(asList(ALL));
});

describe('GroupListPanel：建立班別的評量選項', () => {
  it('沒有任何班別時，也能選到全部題庫', async () => {
    renderPanel([]);
    await waitFor(() => expect(options()).toEqual(ALL));
    expect(ALL.length).toBeGreaterThanOrEqual(4);
  });

  it('現有班別都只用 AI 職能時，仍能選到其他題庫（回歸：以前只列出已用過的）', async () => {
    renderPanel([group(), group({ id: 'g2' })]);
    await waitFor(() => expect(options()).toContain('leadership-9d'));
    expect(options()).toEqual(expect.arrayContaining(ALL));
  });

  it('管理者停用的題庫不列出', async () => {
    assessments.mockResolvedValue(asList(ALL.filter((id) => id !== 'disc')));
    renderPanel([]);
    await waitFor(() => expect(options()).not.toContain('disc'));
    expect(options()).toContain('leadership-9d');
  });

  it('載入失敗時退回全部內建題庫，不讓選單空掉', async () => {
    assessments.mockRejectedValue(new Error('network'));
    renderPanel([]);
    await waitFor(() => expect(options()).toEqual(ALL));
  });

  it('選了別的題庫後，建立班別送出的是選到的題庫', async () => {
    createGroup.mockResolvedValue(group({ id: 'new', assessmentId: 'leadership-9d' }));
    renderPanel([group()]);
    await waitFor(() => expect(options()).toContain('leadership-9d'));
    fireEvent.change(screen.getByLabelText('評量題庫'), { target: { value: 'leadership-9d' } });
    fireEvent.change(screen.getByPlaceholderText('班別名稱（必填）'), { target: { value: '領導力班' } });
    fireEvent.click(screen.getByRole('button', { name: '建立' }));
    await waitFor(() => expect(createGroup).toHaveBeenCalledWith(expect.objectContaining({ name: '領導力班', assessmentId: 'leadership-9d' })));
  });

  it('預設的 AI 職能被停用時，選單與送出的值一致（用第一個可選的）', async () => {
    assessments.mockResolvedValue(asList(['leadership-9d', 'disc']));
    createGroup.mockResolvedValue(group({ id: 'new' }));
    renderPanel([]);
    await waitFor(() => expect(options()).toEqual(['leadership-9d', 'disc']));
    expect(screen.getByLabelText('評量題庫')).toHaveValue('leadership-9d');
    fireEvent.change(screen.getByPlaceholderText('班別名稱（必填）'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: '建立' }));
    await waitFor(() => expect(createGroup).toHaveBeenCalledWith(expect.objectContaining({ assessmentId: 'leadership-9d' })));
  });
});

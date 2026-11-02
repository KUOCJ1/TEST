import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GroupListPanel from '../survey/coach/GroupListPanel.jsx';
import ProjectTemplatesTab from '../survey/admin/ProjectTemplatesTab.jsx';
import { ConfirmProvider } from '../survey/components/ConfirmDialog.jsx';

const m = vi.hoisted(() => ({
  assessments: vi.fn(), createGroup: vi.fn(), deleteGroup: vi.fn(), coachProjectTemplates: vi.fn(),
  adminProjectTemplates: vi.fn(), createProjectTemplate: vi.fn(), updateProjectTemplate: vi.fn(), deleteProjectTemplate: vi.fn(),
}));
vi.mock('../survey/api/client', () => ({ api: m }));
beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

const tpl = { id: 't1', name: '森永高階教練 360', clientName: '森永', assessmentId: 'leadership-360-70', extraAssessmentIds: [], exclusive: false, notes: '' };
const allOn = () => ['ai-competency', 'leadership-9d', 'disc', 'archetype', 'leadership-360-70'].map((id) => ({ id, name: id, enabled: true }));

function renderPanel() {
  const props = { groups: [], setGroups: vi.fn(), selectedGroupId: null, onSelectGroup: vi.fn(), onGroupDeleted: vi.fn(), showToast: vi.fn(), confirm: vi.fn(), onCompareCohorts: vi.fn() };
  render(<GroupListPanel {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /建立班別/ }));
  return props;
}

describe('教練開班：專案範本', () => {
  it('沒有範本時不顯示範本選單，維持原本自選評量', async () => {
    m.assessments.mockResolvedValue(allOn());
    m.coachProjectTemplates.mockResolvedValue([]);
    renderPanel();
    await screen.findByLabelText('評量題庫');
    expect(screen.queryByLabelText('專案範本')).not.toBeInTheDocument();
    expect(screen.getByLabelText('評量題庫')).not.toBeDisabled();
  });

  it('選範本：評量鎖定成範本的評量、公司名稱預設帶入；建立時送出 templateId', async () => {
    m.assessments.mockResolvedValue(allOn());
    m.coachProjectTemplates.mockResolvedValue([tpl]);
    m.createGroup.mockResolvedValue({ id: 'g1', name: '森永班', memberIds: [], assessmentId: 'leadership-360-70' });
    renderPanel();
    const picker = await screen.findByLabelText('專案範本');
    fireEvent.change(picker, { target: { value: 't1' } });
    const assess = screen.getByLabelText('評量題庫');
    expect(assess).toBeDisabled();
    expect(assess).toHaveValue('leadership-360-70');
    expect(screen.getByPlaceholderText('公司名稱（選填）')).toHaveValue('森永');
    expect(screen.getByText(/評量已鎖定/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('班別名稱（必填）'), { target: { value: '森永班' } });
    fireEvent.click(screen.getByRole('button', { name: '建立', exact: true }));
    await waitFor(() => expect(m.createGroup).toHaveBeenCalled());
    expect(m.createGroup.mock.calls[0][0]).toMatchObject({ templateId: 't1', assessmentId: 'leadership-360-70' });
  });

  it('改回「不使用專案範本」又可以自選評量', async () => {
    m.assessments.mockResolvedValue(allOn());
    m.coachProjectTemplates.mockResolvedValue([tpl]);
    renderPanel();
    const picker = await screen.findByLabelText('專案範本');
    fireEvent.change(picker, { target: { value: 't1' } });
    fireEvent.change(picker, { target: { value: '' } });
    expect(screen.getByLabelText('評量題庫')).not.toBeDisabled();
  });
});

describe('管理員維護專案範本', () => {
  const renderTab = () => render(<ConfirmProvider><ProjectTemplatesTab /></ConfirmProvider>);

  it('列出範本；新增時評量選單只有可當主要評量的（沒有課後問卷）', async () => {
    m.adminProjectTemplates.mockResolvedValue([tpl]);
    renderTab();
    expect(await screen.findByText('森永高階教練 360')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /新增範本/ }));
    const options = [...screen.getByLabelText(/評量（固定）/).querySelectorAll('option')].map((o) => o.value);
    expect(options).toContain('leadership-360-70');
    expect(options).not.toContain('ai-course-post');
  });

  it('建立範本：送出名稱、客戶、評量與附加課後問卷', async () => {
    m.adminProjectTemplates.mockResolvedValue([]);
    m.createProjectTemplate.mockResolvedValue({ ...tpl, id: 't2', extraAssessmentIds: ['ai-course-post'] });
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /新增範本/ }));
    fireEvent.change(screen.getByPlaceholderText(/例如：森永/), { target: { value: '新專案' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /附加「課後學習成效問卷」/ }));
    fireEvent.click(screen.getByRole('button', { name: '建立範本' }));
    await waitFor(() => expect(m.createProjectTemplate).toHaveBeenCalled());
    expect(m.createProjectTemplate.mock.calls[0][0]).toMatchObject({ name: '新專案', extraAssessmentIds: ['ai-course-post'] });
    expect(await screen.findByText('已建立範本')).toBeInTheDocument();
  });

  it('伺服器拒絕時顯示原因、表單保留', async () => {
    m.adminProjectTemplates.mockResolvedValue([]);
    m.createProjectTemplate.mockRejectedValue(new Error('請輸入範本名稱'));
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /新增範本/ }));
    fireEvent.click(screen.getByRole('button', { name: '建立範本' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('請輸入範本名稱');
    expect(screen.getByRole('button', { name: '建立範本' })).toBeInTheDocument();
  });
});

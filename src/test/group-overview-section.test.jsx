import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GroupOverviewSection from '../survey/coach/GroupOverviewSection';

// 迴歸測試：Sprint 5 拆分 GroupWorkspace 時漏搬了「作答進度」面板（Sprint 4 的
// 催交追蹤），ProgressPanel 自己的單元測試照樣全綠，所以沒被抓到——這裡直接
// 驗證「總覽」分頁真的有把它渲染出來。

const group = {
  id: 'g1', name: '測試班', assessmentId: 'ai-competency', phase: 'in_progress',
  memberIds: ['u1', 'u2'], groupComment: '', groupTips: [],
};
const directory = [
  { id: 'u1', name: '小明', email: 'ming@x.com' },
  { id: 'u2', name: '小華', email: 'hua@x.com' },
];

function renderSection() {
  render(
    <GroupOverviewSection
      group={group}
      directory={directory}
      groupStats={null}
      memberRows={[]}
      strongestWeakest={null}
      commentedCount={0}
      submissions={[]}
      onGroupUpdated={vi.fn()}
      showToast={vi.fn()}
      confirm={vi.fn()}
      onOpenMember={vi.fn()}
    />,
  );
}

describe('GroupOverviewSection', () => {
  it('總覽分頁包含作答進度面板與催交按鈕', () => {
    renderSection();
    expect(screen.getByText('作答進度')).toBeInTheDocument();
    expect(screen.getByText('課前未完成（2）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /複製提醒訊息/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /寄送提醒信/ })).toBeInTheDocument();
  });

  it('總覽分頁包含班級整體評語表單', () => {
    renderSection();
    expect(screen.getByText('班級整體評語')).toBeInTheDocument();
  });
});

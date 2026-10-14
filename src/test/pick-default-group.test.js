import { describe, it, expect } from 'vitest';
import { pickDefaultGroup } from '../survey/utils/groups.js';

describe('pickDefaultGroup：教練後台進頁面自動選哪個班', () => {
  const g = (id, phase, updatedAt, createdAt = '2026-01-01T00:00:00Z') => ({ id, phase, updatedAt, createdAt });

  it('沒有班別回 null', () => {
    expect(pickDefaultGroup([])).toBeNull();
    expect(pickDefaultGroup(undefined)).toBeNull();
  });
  it('優先選進行中的班；多個進行中選最近更新的', () => {
    const list = [g('a', 'in_progress', '2026-03-01'), g('b', 'closed', '2026-09-01'), g('c', 'in_progress', '2026-05-01')];
    expect(pickDefaultGroup(list).id).toBe('c');
  });
  it('沒有進行中的就選最近建立的', () => {
    const list = [g('a', 'closed', '2026-03-01', '2026-01-01'), g('b', 'not_started', '2026-02-01', '2026-06-01'), g('c', 'published', '2026-09-01', '2026-03-01')];
    expect(pickDefaultGroup(list).id).toBe('b');
  });
  it('缺少日期欄位也不會壞', () => {
    expect(pickDefaultGroup([{ id: 'x', phase: 'in_progress' }, { id: 'y', phase: 'in_progress' }])).toBeTruthy();
  });
});

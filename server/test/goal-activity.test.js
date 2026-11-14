import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDb } from '../src/db.js';
import { recordActivity, goalSummaryForGroup, membersWithoutGoal, retentionForGroup, MIN_N } from '../src/lib/goalActivity.js';

const DAY = 86400000;
const NOW = Date.parse('2026-11-14T00:00:00Z');

function world(n = 4) {
  const db = createDb(':memory:');
  const users = Array.from({ length: n }, (_, i) => ({ id: randomUUID(), name: `u${i}`, email: `u${i}@x.co`, role: 'user', preferences: {} }));
  db.data.users.push(...users);
  const group = { id: randomUUID(), name: '班', assessmentId: 'leadership-9d', memberIds: users.map((u) => u.id), excludedUserIds: [] };
  db.data.groups.push(group);
  return { db, users, group };
}
const goal = (userId, extra = {}) => ({ id: randomUUID(), userId, assessmentId: 'leadership-9d', text: 't', createdAt: new Date(NOW - 20 * DAY).toISOString(), checkins: [], ...extra });
const selfSub = (userId, daysAgo) => ({ id: randomUUID(), userId, assessmentId: 'leadership-9d', raterType: 'self', createdAt: new Date(NOW - daysAgo * DAY).toISOString() });

describe('recordActivity()', () => {
  test('同一天只寫一次；隔天再寫；最多保留 120 天', () => {
    const { db, users } = world(1);
    assert.equal(recordActivity(db, users[0], NOW), true);
    assert.equal(recordActivity(db, users[0], NOW + 1000), false);
    assert.equal(recordActivity(db, users[0], NOW + DAY), true);
    assert.deepEqual(users[0].activeDays, ['2026-11-14', '2026-11-15']);
    users[0].activeDays = Array.from({ length: 130 }, (_, i) => `2026-01-${String(i).padStart(3, '0')}`);
    recordActivity(db, users[0], NOW + 2 * DAY);
    assert.equal(users[0].activeDays.length, 120);
  });
});

describe('goalSummaryForGroup()', () => {
  test('只有人數：已設定、近 14 天有回報、沒設定', () => {
    const { db, users, group } = world(4);
    db.data.goals.push(goal(users[0].id, { checkins: [{ id: 'c', at: new Date(NOW - 3 * DAY).toISOString() }] }));
    db.data.goals.push(goal(users[1].id, { checkins: [{ id: 'c', at: new Date(NOW - 40 * DAY).toISOString() }] }));
    db.data.goals.push(goal(users[2].id, { assessmentId: 'disc' })); // 別份評量的目標不算
    const s = goalSummaryForGroup(db, group, NOW);
    assert.deepEqual({ ...s }, { hidden: false, members: 4, withGoal: 2, recentCheckin: 1, noGoal: 2, recentDays: 14 });
    assert.equal(membersWithoutGoal(db, group).length, 2);
  });
  test('成員少於門檻：不顯示；停用的人不計', () => {
    const { db, users, group } = world(MIN_N);
    users[0].disabled = true;
    assert.equal(goalSummaryForGroup(db, group, NOW).hidden, true);
  });
  test('排除（不列入統計）不改變數字：教練不能靠排除某人前後比對回推他有沒有目標', () => {
    const { db, users, group } = world(5);
    db.data.goals.push(goal(users[0].id));
    const before = goalSummaryForGroup(db, group, NOW);
    group.excludedUserIds = [users[0].id];
    assert.deepEqual(goalSummaryForGroup(db, group, NOW), before);
  });
});

describe('retentionForGroup()', () => {
  test('只計視窗已走完的人；視窗內有活動日才算回來；人數不足不顯示', () => {
    const { db, users, group } = world(5);
    // 每人 10 天前自評；前 3 人在第 2～5 天有來過，第 4 人沒來，第 5 人的活動在視窗外。
    users.forEach((u) => db.data.submissions.push(selfSub(u.id, 10)));
    const dayAt = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString().slice(0, 10);
    users[0].activeDays = [dayAt(8)]; users[1].activeDays = [dayAt(6)]; users[2].activeDays = [dayAt(4)];
    users[4].activeDays = [dayAt(10)]; // 作答當天，不算回訪
    const r7 = retentionForGroup(db, group, 7, NOW);
    assert.deepEqual({ ...r7 }, { hidden: false, eligible: 5, returned: 3, rate: 60 });
    // 30 天視窗還沒走完：沒有符合條件的人
    assert.equal(retentionForGroup(db, group, 30, NOW).hidden, true);
  });
  test('符合條件的人少於 3：不顯示', () => {
    const { db, users, group } = world(5);
    users.slice(0, 2).forEach((u) => db.data.submissions.push(selfSub(u.id, 10)));
    assert.equal(retentionForGroup(db, group, 7, NOW).hidden, true);
  });
});

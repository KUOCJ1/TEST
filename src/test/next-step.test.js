import { describe, it, expect } from 'vitest';
import { computeNextStep } from '../survey/utils/nextStep';

const assessments = [
  { id: 'ai-competency', name: 'AI 全方位職能實戰課前評測', enabled: true },
  { id: 'leadership-9d', name: '經贏® 領導力九大構面行為評量', enabled: true },
];

describe('computeNextStep', () => {
  it('完全沒有任何評量可用時回傳 null', () => {
    expect(computeNextStep({ assessments: [] })).toBeNull();
  });

  it('全新帳號（沒有班級、沒有作答紀錄）指向第一個可用題庫', () => {
    const result = computeNextStep({ assessments, mySubmissions: [], myGroups: [], groupMembers: [] });
    expect(result).toEqual({ kind: 'start-any', assessmentId: 'ai-competency', assessmentName: 'AI 全方位職能實戰課前評測' });
  });

  it('已停用的題庫不會被當成「第一個可用題庫」', () => {
    const disabledFirst = [{ id: 'ai-competency', name: 'X', enabled: false }, assessments[1]];
    const result = computeNextStep({ assessments: disabledFirst, mySubmissions: [], myGroups: [], groupMembers: [] });
    expect(result.assessmentId).toBe('leadership-9d');
  });

  it('①：所屬班級進行中且課前未作答', () => {
    const myGroups = [{ id: 'g1', assessmentId: 'leadership-9d', phase: 'in_progress' }];
    const result = computeNextStep({ assessments, mySubmissions: [], myGroups, groupMembers: [] });
    expect(result).toEqual({
      kind: 'pre',
      assessmentId: 'leadership-9d',
      assessmentName: '經贏® 領導力九大構面行為評量',
      groupId: 'g1',
    });
  });

  it('②：課前已完成、班級進行中 → 開始課後複測', () => {
    const myGroups = [{ id: 'g1', assessmentId: 'leadership-9d', phase: 'in_progress' }];
    const mySubmissions = [{ assessmentId: 'leadership-9d', groupId: 'g1', phase: 'pre', raterType: 'self' }];
    const result = computeNextStep({ assessments, mySubmissions, myGroups, groupMembers: [] });
    expect(result).toMatchObject({ kind: 'post', assessmentId: 'leadership-9d', groupId: 'g1' });
  });

  it('班級「尚未開始」時不會被當成①或②的候選', () => {
    const myGroups = [{ id: 'g1', assessmentId: 'leadership-9d', phase: 'not_started' }];
    const result = computeNextStep({ assessments, mySubmissions: [], myGroups, groupMembers: [] });
    // 沒有任何作答紀錄、也沒有其他可用班級 → 退回「新帳號」邏輯。
    expect(result.kind).toBe('start-any');
  });

  it('③：課前課後都做完了，但還有同學的 360° 他評沒做', () => {
    const myGroups = [{ id: 'g1', assessmentId: 'leadership-9d', phase: 'closed' }];
    const mySubmissions = [
      { assessmentId: 'leadership-9d', groupId: 'g1', phase: 'pre', raterType: 'self' },
      { assessmentId: 'leadership-9d', groupId: 'g1', phase: 'post', raterType: 'self' },
    ];
    const groupMembers = [{ id: 'u2', name: '小華' }, { id: 'u3', name: '小美' }];
    const result = computeNextStep({ assessments, mySubmissions, myGroups, groupMembers });
    expect(result).toMatchObject({ kind: 'rate-others', assessmentId: 'leadership-9d', count: 2 });
  });

  it('已經評過的同學不算在待評人數裡', () => {
    const mySubmissions = [
      { assessmentId: 'leadership-9d', groupId: 'g1', phase: 'pre', raterType: 'self' },
      { assessmentId: 'leadership-9d', rateeId: 'u2', raterType: 'peer' },
    ];
    const groupMembers = [{ id: 'u2', name: '小華' }, { id: 'u3', name: '小美' }];
    const result = computeNextStep({ assessments, mySubmissions, myGroups: [], groupMembers });
    expect(result).toMatchObject({ kind: 'rate-others', count: 1 });
  });

  it('不支援 360° 的題庫不會觸發「還有同事等你評分」', () => {
    const mySubmissions = [{ assessmentId: 'ai-competency', groupId: 'g1', phase: 'pre', raterType: 'self' }];
    const groupMembers = [{ id: 'u2', name: '小華' }];
    const result = computeNextStep({ assessments: [assessments[0]], mySubmissions, myGroups: [], groupMembers });
    expect(result.kind).toBe('view-report');
  });

  it('④：有目標到了建議複測日 → 提醒複測', () => {
    const mySubmissions = [{ assessmentId: 'leadership-9d', groupId: null, phase: 'pre', raterType: 'self' }];
    const goals = [{
      assessmentId: 'leadership-9d', text: '每週練習一次公開表達', achievedAt: null,
      reviewDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 昨天到期
    }];
    const result = computeNextStep({ assessments, mySubmissions, myGroups: [], groupMembers: [], goals });
    expect(result).toMatchObject({ kind: 'retest-reminder', assessmentId: 'leadership-9d', goalText: '每週練習一次公開表達' });
  });

  it('尚未到複測日的目標不會觸發提醒', () => {
    const mySubmissions = [{ assessmentId: 'leadership-9d', groupId: null, phase: 'pre', raterType: 'self' }];
    const goals = [{
      assessmentId: 'leadership-9d', text: '未到期', achievedAt: null,
      reviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 明天才到期
    }];
    const result = computeNextStep({ assessments, mySubmissions, myGroups: [], groupMembers: [], goals });
    expect(result.kind).toBe('view-report');
  });

  it('已達成的目標即使複測日已過也不會觸發提醒', () => {
    const mySubmissions = [{ assessmentId: 'leadership-9d', groupId: null, phase: 'pre', raterType: 'self' }];
    const goals = [{
      assessmentId: 'leadership-9d', text: '已達成', achievedAt: '2026-01-01T00:00:00Z',
      reviewDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    }];
    const result = computeNextStep({ assessments, mySubmissions, myGroups: [], groupMembers: [], goals });
    expect(result.kind).toBe('view-report');
  });

  it('優先序：360° 待評分排在複測提醒之前', () => {
    const mySubmissions = [{ assessmentId: 'leadership-9d', groupId: null, phase: 'pre', raterType: 'self' }];
    const groupMembers = [{ id: 'u2', name: '小華' }];
    const goals = [{
      assessmentId: 'leadership-9d', text: '目標', achievedAt: null,
      reviewDate: new Date(Date.now() - 1000).toISOString(),
    }];
    const result = computeNextStep({ assessments, mySubmissions, myGroups: [], groupMembers, goals });
    expect(result.kind).toBe('rate-others');
  });

  it('④：都完成了 → 看報告', () => {
    const mySubmissions = [{ assessmentId: 'ai-competency', groupId: null, phase: 'pre', raterType: 'self' }];
    const result = computeNextStep({ assessments, mySubmissions, myGroups: [], groupMembers: [] });
    expect(result).toEqual({ kind: 'view-report', assessmentId: 'ai-competency', assessmentName: 'AI 全方位職能實戰課前評測' });
  });

  it('優先序：即使同時有 360° 待評，課前未作答仍排在最前面', () => {
    const myGroups = [{ id: 'g1', assessmentId: 'leadership-9d', phase: 'in_progress' }];
    const groupMembers = [{ id: 'u2', name: '小華' }];
    const result = computeNextStep({ assessments, mySubmissions: [], myGroups, groupMembers });
    expect(result.kind).toBe('pre');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MultiRaterDashboard from '../survey/analysis/MultiRaterDashboard.jsx';
import ManagerShareToggle from '../survey/components/compass/ManagerShareToggle.jsx';
import MultiRaterTab from '../survey/coach/MultiRaterTab.jsx';

const { rateeSubmissions, setShare } = vi.hoisted(() => ({ rateeSubmissions: vi.fn(), setShare: vi.fn() }));
vi.mock('../survey/api/client', () => ({ api: { rateeSubmissions } }));
vi.mock('../survey/auth/useAuth', () => ({ useAuth: () => ({ setCompassManagerShare: setShare }) }));

const dim = (id, name, avg) => ({ id, name, subtitle: name, color: '#2b6cb0', score: avg * 4, max: 20, percent: Math.round((avg / 5) * 100), average: avg, answered: 4, rating: { label: '熟練' } });
const dims = (avg) => ['find', 'aim'].map((id) => dim(id, id === 'find' ? '洞察情勢' : '聚焦應變', avg));
const self = { id: 's', raterType: 'self', userId: 'u', rateeId: 'u', createdAt: '2020-01-01', result: { assessmentId: 'leadership-compass', total: 1, dimensions: dims(4.5) } };
const others = (count) => ({ id: 'agg', raterType: 'others', aggregate: true, count, userId: 'anonymous', userName: '匿名', result: { assessmentId: 'leadership-compass', total: 0, dimensions: dims(3.2) } });

beforeEach(() => { rateeSubmissions.mockReset(); setShare.mockReset(); });

describe('領導力羅盤：受評者的 360° 畫面', () => {
  it('有他評合計（4 位）：顯示落差與人數，並稱呼為「他評合計」', async () => {
    rateeSubmissions.mockResolvedValue([self, others(4)]);
    render(<MultiRaterDashboard rateeId="u" rateeName="小明" assessmentId="leadership-compass" />);
    expect(await screen.findByText('自評與他評的落差')).toBeInTheDocument();
    expect(screen.getByText(/依 4 位他評者的平均/)).toBeInTheDocument();
    expect(screen.getAllByText(/自評高於他評/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/他評合計/).length).toBeGreaterThan(0);
  });

  it('伺服器沒有回傳他評（不足門檻）：只顯示說明，不顯示任何他評數字', async () => {
    rateeSubmissions.mockResolvedValue([self]);
    const { container } = render(<MultiRaterDashboard rateeId="u" rateeName="小明" assessmentId="leadership-compass" />);
    expect(await screen.findByText(/不足 3 位/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/他評 3\.2/);
  });

  it('不使用舊版的四象限與 ±0.5 落差表', async () => {
    rateeSubmissions.mockResolvedValue([self, others(3)]);
    render(<MultiRaterDashboard rateeId="u" rateeName="小明" assessmentId="leadership-compass" />);
    await screen.findByText('自評與他評的落差');
    expect(screen.queryByText('360° 四象限分析')).not.toBeInTheDocument();
    expect(screen.queryByText('自我認知落差分析')).not.toBeInTheDocument();
  });

  it('其他題庫（L9D）仍使用舊版的落差表', async () => {
    const l9 = (s) => ({ ...s, result: { ...s.result, assessmentId: 'leadership-9d' } });
    rateeSubmissions.mockResolvedValue([l9(self), { ...l9(others(1)), aggregate: undefined, raterType: 'peer', count: undefined }]);
    render(<MultiRaterDashboard rateeId="u" rateeName="小明" assessmentId="leadership-9d" />);
    expect(await screen.findByText('自我認知落差分析')).toBeInTheDocument();
  });
});

describe('ManagerShareToggle', () => {
  it('預設未同意：按下去呼叫同意', async () => {
    setShare.mockResolvedValue({});
    const onChanged = vi.fn();
    render(<ManagerShareToggle user={{ compassManagerShare: null }} onChanged={onChanged} />);
    expect(screen.getByText(/預設不顯示/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /同意顯示上級評分/ }));
    await waitFor(() => expect(setShare).toHaveBeenCalledWith(true));
    expect(onChanged).toHaveBeenCalled();
  });
  it('已同意：可撤回', async () => {
    setShare.mockResolvedValue({});
    render(<ManagerShareToggle user={{ compassManagerShare: { granted: true } }} />);
    expect(screen.getByText(/您已同意顯示/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /撤回同意/ }));
    await waitFor(() => expect(setShare).toHaveBeenCalledWith(false));
  });
  it('失敗時顯示錯誤', async () => {
    setShare.mockRejectedValue(new Error('網路錯誤'));
    render(<ManagerShareToggle user={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /同意顯示上級評分/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('網路錯誤');
  });
});

describe('教練端 360° 分頁（領導力羅盤）', () => {
  const users = [{ id: 'u1', name: '甲', role: 'user' }];
  const sub = (raterType, i) => ({ id: `anon-${i}`, rateeId: 'u1', userId: 'anonymous', raterType, assessmentId: 'leadership-compass', anonymized: true });
  it('顯示各類回收份數與「不足」，並說明教練看不到身分；不傳 canDeanonymize', () => {
    const subs = [{ id: 's', rateeId: 'u1', userId: 'u1', raterType: 'self', assessmentId: 'leadership-compass' }, sub('peer', 1), sub('peer', 2), sub('subordinate', 3), sub('subordinate', 4), sub('subordinate', 5)];
    render(<MultiRaterTab users={users} submissions={subs} />);
    expect(screen.getByText(/身分與個別分數對教練不公開/)).toBeInTheDocument();
    expect(screen.getByText('2 份（不足）')).toBeInTheDocument();
    expect(screen.getByText('3 份')).toBeInTheDocument();
  });
});

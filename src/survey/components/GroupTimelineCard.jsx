import { useState } from 'react';
import PhaseBadge from './PhaseBadge';
import { useToast } from './useToast';
import { api } from '../api/client';

export default function GroupTimelineCard({ group, onUpdated, showHeader = false }) {
  const [startDate, setStartDate] = useState(group.startDate ? group.startDate.slice(0, 10) : '');
  const [endDate, setEndDate] = useState(group.endDate ? group.endDate.slice(0, 10) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const showToast = useToast();

  const handleSaveDates = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateGroup(group.id, { startDate: startDate || null, endDate: endDate || null });
      onUpdated(updated);
      showToast('已儲存日期');
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await api.publishGroup(group.id);
      onUpdated(updated);
      // 落點是 published 才代表學員真的看得到；施測還沒截止時發佈只是「預約」，
      // 必須講清楚，否則教練會以為按了沒反應。
      showToast(updated.phase === 'published'
        ? '已發佈成果，學員現在可查看報告'
        : '已設定發佈，將於施測截止後自動開放給學員');
    } catch (e) {
      setError(e.message || '發佈失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await api.unpublishGroup(group.id);
      onUpdated(updated);
      showToast('已取消發佈');
    } catch (e) {
      setError(e.message || '取消發佈失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {showHeader ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-700">{group.name}</span>
            {group.companyName && <span className="text-xs text-slate-400">{group.companyName}</span>}
          </div>
        ) : (
          <h3 className="font-semibold text-slate-700">施測時間軸</h3>
        )}
        <PhaseBadge phase={group.phase} />
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">開始日期</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">截止日期</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleSaveDates} disabled={saving} className="btn-secondary btn-sm">
          {saving ? '處理中…' : '儲存日期'}
        </button>
        {group.publishedAt ? (
          <button type="button" onClick={handleUnpublish} disabled={saving} className="btn-warning btn-sm">
            取消發佈
          </button>
        ) : (
          <button type="button" onClick={handlePublish} disabled={saving} className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700">
            發佈成果（開放閱覽）
          </button>
        )}
        {group.publishedAt && (
          <span className="text-xs text-slate-400">
            發佈於 {new Date(group.publishedAt).toLocaleDateString('zh-TW')}
          </span>
        )}
      </div>

      {/* 發佈只有在施測截止後才生效（phase 由日期與 publishedAt 共同決定）。
          已按發佈但尚未截止時，若不說明，教練會誤以為發佈失敗。 */}
      {group.publishedAt && group.phase !== 'published' && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          已設定發佈，但施測尚未截止，學員目前仍看不到報告。
          {group.endDate
            ? `將於截止日（${new Date(group.endDate).toLocaleDateString('zh-TW')}）之後自動開放。`
            : '請先設定截止日期，否則不會開放。'}
          若要立即開放，請將截止日期改為今天之前。
        </p>
      )}
    </div>
  );
}

import { useCallback, useMemo, useState } from 'react';
import { api } from '../api/client';
import { getAssessment } from '../data/assessments/index.js';
import { latestPerUser } from '../utils/analytics';
import { useAssessmentFilter } from '../hooks/useAssessmentFilter';
import { formatDate } from '../utils/format';
import CommentEditor from './CommentEditor';

export default function IndividualTab({ users, submissions, currentUserId }) {
  const [editingSubId, setEditingSubId] = useState(null);
  const [commentPatch, setCommentPatch] = useState({});
  const [deleteError, setDeleteError] = useState('');

  const localSubs = useMemo(
    () => submissions.map((s) => (commentPatch[s.id] ? { ...s, comments: commentPatch[s.id] } : s)),
    [submissions, commentPatch],
  );

  const { assessmentIds, activeId: selectedAssessmentId, setSelectedId, filtered: filteredSubs } =
    useAssessmentFilter(localSubs, 'ai-competency');

  const latestByUser = latestPerUser(filteredSubs);

  const rows = latestByUser.map((s) => {
    const user = users.find((u) => u.id === s.userId);
    const all = s.comments ?? [];
    const myComment = all.find((c) => c.coachId === currentUserId) ?? null;
    const otherComments = all.filter((c) => c.coachId !== currentUserId);
    return { sub: s, user, myComment, otherComments };
  }).sort((a, b) => (b.sub.result?.total ?? 0) - (a.sub.result?.total ?? 0));

  const patchComments = useCallback((subId, updater) => {
    setCommentPatch((prev) => {
      const base = localSubs.find((s) => s.id === subId)?.comments ?? [];
      return { ...prev, [subId]: updater(base) };
    });
  }, [localSubs]);

  const handleCommentSaved = (subId, comment) => {
    patchComments(subId, (prev) => {
      const others = prev.filter((c) => c.coachId !== comment.coachId);
      return [comment, ...others];
    });
    setEditingSubId(null);
  };

  const handleDelete = async (subId, commentId) => {
    if (!window.confirm('確定刪除此評語？')) return;
    setDeleteError('');
    try {
      await api.deleteComment(subId, commentId);
      patchComments(subId, (prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) {
      setDeleteError(e.message || '刪除失敗');
    }
  };

  return (
    <div>
      {assessmentIds.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {assessmentIds.map((id) => (
            <button key={id} type="button" onClick={() => setSelectedId(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                selectedAssessmentId === id ? 'bg-brand-600 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {getAssessment(id)?.NAME ?? id}
            </button>
          ))}
        </div>
      )}

      {deleteError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {deleteError}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="py-8 text-center text-slate-400">此評量尚無作答資料。</p>
      ) : (
        <div className="space-y-3">
          {rows.map(({ sub, user, myComment, otherComments }) => (
            <div key={sub.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold text-slate-800">{user?.name ?? sub.userName}</span>
                <span className="text-sm text-slate-400">{user?.email ?? ''}</span>
                <span className="font-bold text-brand-700">{sub.result?.total} / {sub.result?.maxScore}</span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                  style={{ background: sub.result?.level?.color }}
                >
                  {sub.result?.level?.badge}
                </span>
                <span className="text-xs text-slate-400">{formatDate(sub.createdAt)}</span>
                <div className="ml-auto flex gap-2">
                  {myComment ? (
                    <>
                      <button type="button" onClick={() => setEditingSubId(editingSubId === sub.id ? null : sub.id)}
                        className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                        ✏ 編輯評語
                      </button>
                      <button type="button" onClick={() => handleDelete(sub.id, myComment.id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-500 hover:bg-red-100">
                        刪除
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setEditingSubId(editingSubId === sub.id ? null : sub.id)}
                      className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                      + 新增評語
                    </button>
                  )}
                </div>
              </div>

              {myComment && editingSubId !== sub.id && (
                <div className="mt-2 rounded-lg border-l-4 border-brand-400 bg-brand-50 px-3 py-2">
                  <p className="text-xs font-semibold text-brand-600">我的評語</p>
                  <p className="text-sm text-slate-700">{myComment.text}</p>
                  {myComment.tips?.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {myComment.tips.map((t, i) => (
                        <li key={i} className="text-xs text-slate-600">・{t}</li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-xs text-slate-400">更新於 {formatDate(myComment.updatedAt)}</p>
                </div>
              )}

              {otherComments?.length > 0 && (
                <div className="mt-2 space-y-2">
                  {otherComments.map((c) => (
                    <div key={c.id} className="rounded-lg border-l-4 border-slate-300 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-semibold text-slate-500">其他教練：{c.coachName}</p>
                      <p className="text-sm text-slate-700">{c.text}</p>
                      {c.tips?.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {c.tips.map((t, i) => (
                            <li key={i} className="text-xs text-slate-600">・{t}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {editingSubId === sub.id && (
                <CommentEditor
                  submission={sub}
                  existingComment={myComment}
                  onSaved={(c) => handleCommentSaved(sub.id, c)}
                  onCancel={() => setEditingSubId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

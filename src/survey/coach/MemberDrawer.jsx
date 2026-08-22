import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X, FileText, Pencil } from 'lucide-react';
import ResultPanel from '../components/ResultPanel';
import TrendChart from '../components/charts/TrendChart';
import { CoachCommentPanel } from '../components/CoachCommentPanel';
import CommentEditor from './CommentEditor';
import { computePercentile } from '../utils/analytics';
import { buildJourneyNarrative } from '../utils/narrative';
import { formatDateShort } from '../utils/format';

/**
 * 報告＋評語合一的側邊抽屜。教練點一位成員就在同一個畫面看報告、看其他教練的
 * 評語、寫（或編輯）自己的評語，並可直接切換上一位／下一位，不必關閉重找。
 */
export default function MemberDrawer({
  members,
  selectedIndex,
  onSelectIndex,
  onClose,
  groupBenchmark,
  focusDimensionIds = [],
  currentUserId,
  onCommentSaved,
  onExportPdf,
}) {
  const member = members[selectedIndex] ?? null;
  const [editing, setEditing] = useState(false);

  // 換人時，評語編輯狀態重置，不要把上一位的「編輯中」狀態帶到下一位。渲染中直接
  // 調整狀態（React 建議的做法），而不是用 effect——避免多一次不必要的重渲染。
  const [lastUserId, setLastUserId] = useState(member?.userId);
  if (member?.userId !== lastUserId) {
    setLastUserId(member?.userId);
    setEditing(false);
  }

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && selectedIndex < members.length - 1) onSelectIndex(selectedIndex + 1);
      if (e.key === 'ArrowLeft' && selectedIndex > 0) onSelectIndex(selectedIndex - 1);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, onSelectIndex, selectedIndex, members.length]);

  if (!member) return null;

  const comments = member.submission.comments ?? [];
  const myComment = comments.find((c) => c.coachId === currentUserId) ?? null;
  const otherComments = comments.filter((c) => c.coachId !== currentUserId);
  const percentile = groupBenchmark?.totals?.length >= 2
    ? computePercentile(member.total, groupBenchmark.totals)
    : null;

  const handleSaved = (comment) => {
    onCommentSaved(member.submission.id, comment);
    setEditing(false);
  };

  // 個人歷程：這位學員在本班的所有作答（新到舊）。只有一筆時不顯示趨勢區塊。
  const history = member.history ?? [member.submission];
  const hasJourney = history.length > 1;
  const journeyNarrative = hasJourney ? buildJourneyNarrative(history) : '';
  const trendPoints = [...history].reverse().map((s) => ({
    label: formatDateShort(s.createdAt),
    value: s.result.total,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 print:hidden"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${member.name} 的評測報告`}
        className="flex h-full w-full max-w-5xl flex-col bg-paper-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 抽屜頭：姓名／上一位下一位／關閉 */}
        <div className="flex items-center gap-3 border-b border-paper-300 bg-paper-50 px-5 py-3.5 sm:px-7">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-serif text-lg font-bold text-ink-700">{member.name}</h3>
            <p className="truncate text-xs text-slate-400">{member.email}</p>
          </div>
          <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">
            {selectedIndex + 1} / {members.length}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onSelectIndex(selectedIndex - 1)}
              disabled={selectedIndex <= 0}
              aria-label="上一位"
              className="btn-icon disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onSelectIndex(selectedIndex + 1)}
              disabled={selectedIndex >= members.length - 1}
              aria-label="下一位"
              className="btn-icon disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <button type="button" onClick={onExportPdf} className="btn-secondary btn-sm shrink-0">
            <FileText className="h-3.5 w-3.5" /> <span className="hidden sm:inline">產出報告</span>
          </button>
          <button type="button" onClick={onClose} aria-label="關閉" className="btn-icon shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 抽屜內容：左報告、右評語（窄螢幕上下堆疊）*/}
        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0">
              {hasJourney && (
                <div className="mb-5 rounded-md bg-paper-50 p-4 ring-1 ring-paper-300">
                  <h4 className="mb-1 font-serif text-sm font-bold text-ink-700">
                    學員歷程
                    <span className="ml-2 font-sans text-xs font-normal text-slate-400">
                      本班共 {history.length} 次作答
                    </span>
                  </h4>
                  {journeyNarrative && (
                    <p className="mb-3 text-sm leading-relaxed text-slate-600">{journeyNarrative}</p>
                  )}
                  <TrendChart
                    points={trendPoints}
                    min={member.submission.result.minScore}
                    max={member.submission.result.maxScore}
                  />
                </div>
              )}
              <ResultPanel
                result={member.submission.result}
                percentile={percentile}
                benchmarkDims={groupBenchmark?.dimensionAverages ?? null}
                focusDimensionIds={focusDimensionIds}
                readOnly
              />
              <CoachCommentPanel comments={otherComments} />
            </div>

            <div className="lg:sticky lg:top-0">
              {editing || !myComment ? (
                <CommentEditor
                  submission={member.submission}
                  existingComment={myComment}
                  onSaved={handleSaved}
                  onCancel={myComment ? () => setEditing(false) : () => {}}
                />
              ) : (
                <div className="rounded-md bg-paper-50 p-4 ring-1 ring-paper-300">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-serif text-sm font-bold text-ink-700">我的評語</h4>
                    <button type="button" onClick={() => setEditing(true)} className="btn-ghost btn-sm">
                      <Pencil className="h-3.5 w-3.5" /> 編輯
                    </button>
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{myComment.text}</p>
                  {myComment.tips?.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {myComment.tips.map((t, i) => (
                        <li key={i} className="text-xs text-slate-600">・{t}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { formatDate } from '../utils/format';

export function CoachCommentPanel({ comments }) {
  if (!comments?.length) return null;
  return (
    <section className="mt-6 rounded-md bg-brass-50/60 px-5 py-6 ring-1 ring-brass-100 sm:px-7">
      <div className="mb-4 flex items-center gap-2">
        <svg className="h-5 w-5 text-brass-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3M12 3l2.5 2M12 3 9.5 5" />
          <circle cx="12" cy="12" r="3.2" />
          <path strokeLinecap="round" d="M6 20c0-3 2.7-5.4 6-5.4s6 2.4 6 5.4" />
        </svg>
        <h3 className="font-serif text-base font-bold text-ink-700">教練評語</h3>
      </div>
      <div className="space-y-5">
        {comments.map((c) => (
          <div key={c.id}>
            <div className="mb-1 flex items-center gap-2">
              <span className="font-semibold text-brass-600">{c.coachName}</span>
              <span className="text-xs text-slate-400">{formatDate(c.updatedAt)}</span>
            </div>
            <p className="leading-relaxed text-slate-700">{c.text}</p>
            {c.tips?.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-sm font-semibold text-brass-600">精進建議</p>
                <ol className="space-y-1.5">
                  {c.tips.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brass-100 text-xs font-bold text-brass-600">
                        {i + 1}
                      </span>
                      {tip}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function GroupCommentPanel({ group }) {
  if (!group || (!group.groupComment && !group.groupTips?.length)) return null;
  return (
    <section className="mt-6 rounded-md bg-paper-200 px-5 py-6 ring-1 ring-paper-300 sm:px-7">
      <div className="mb-3 flex items-start gap-3">
        <svg className="h-6 w-6 shrink-0 text-ink-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
          <rect x="5" y="4" width="9" height="16" rx="1" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 9h5v11h-5M8 8h.01M11 8h.01M8 12h.01M11 12h.01M8 16h.01M11 16h.01" />
        </svg>
        <div>
          <h3 className="font-serif text-base font-bold text-ink-700">{group.name}</h3>
          {group.companyName && (
            <p className="text-xs text-slate-500">{group.companyName}</p>
          )}
          <p className="text-xs text-slate-400">教練：{group.coachName}</p>
        </div>
      </div>
      {group.groupComment && (
        <p className="leading-relaxed text-slate-700">{group.groupComment}</p>
      )}
      {group.groupTips?.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-sm font-semibold text-ink-600">班級精進建議</p>
          <ol className="space-y-1.5">
            {group.groupTips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-paper-300 text-xs font-bold text-ink-600">
                  {i + 1}
                </span>
                {tip}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

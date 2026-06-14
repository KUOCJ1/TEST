import { formatDate } from '../utils/format';

export function CoachCommentPanel({ comments }) {
  if (!comments?.length) return null;
  return (
    <section className="mt-6 rounded-2xl bg-gradient-to-b from-violet-50 to-white px-5 py-6 shadow-lg ring-2 ring-violet-200 sm:px-7">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-2xl">👨‍🏫</span>
        <h3 className="text-base font-bold text-violet-800">教練評語</h3>
      </div>
      <div className="space-y-5">
        {comments.map((c) => (
          <div key={c.id}>
            <div className="mb-1 flex items-center gap-2">
              <span className="font-semibold text-violet-700">{c.coachName}</span>
              <span className="text-xs text-slate-400">{formatDate(c.updatedAt)}</span>
            </div>
            <p className="leading-relaxed text-slate-700">{c.text}</p>
            {c.tips?.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-sm font-semibold text-violet-600">💡 精進建議</p>
                <ol className="space-y-1.5">
                  {c.tips.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
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
    <section className="mt-6 rounded-2xl bg-gradient-to-b from-indigo-50 to-white px-5 py-6 shadow-lg ring-2 ring-indigo-200 sm:px-7">
      <div className="mb-3 flex items-start gap-3">
        <span className="text-2xl">🏢</span>
        <div>
          <h3 className="text-base font-bold text-indigo-800">{group.name}</h3>
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
          <p className="mb-2 text-sm font-semibold text-indigo-600">💡 班級精進建議</p>
          <ol className="space-y-1.5">
            {group.groupTips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
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

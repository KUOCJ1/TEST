import GroupTimelineCard from '../components/GroupTimelineCard';

export default function GroupsTab({ groups, onGroupUpdated }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-6 py-12 text-center text-slate-500 shadow-lg shadow-slate-200/60">
        目前尚無班別。請至「教練後台 → 班別管理」建立班別後，即可在此設定時間軸與發佈。
      </div>
    );
  }

  return (
    <section>
      <p className="mb-4 text-sm text-slate-500">
        設定各班別的施測開始/截止日期，並在教練完成審閱後發佈成果，讓學員可查看 360° 報告。
      </p>
      <div className="space-y-3">
        {groups.map((g) => (
          <GroupTimelineCard key={g.id} group={g} onUpdated={onGroupUpdated} showHeader />
        ))}
      </div>
    </section>
  );
}

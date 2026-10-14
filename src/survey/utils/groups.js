// 預設要自動選哪個班：進行中的（最近更新優先）→ 否則最近建立的。
export function pickDefaultGroup(groups) {
  if (!groups?.length) return null;
  const byRecent = (a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0) - new Date(a.updatedAt ?? a.createdAt ?? 0);
  const active = groups.filter((g) => g.phase === 'in_progress').sort(byRecent);
  return active[0] ?? [...groups].sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))[0];
}


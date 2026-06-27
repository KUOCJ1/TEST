import { formatDate } from './format';

export function buildCsvBlob(rows, filename) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAdminCsv(rows, activeConfig, assessmentName) {
  if (!rows.length) return;
  const dimHeaders = (activeConfig?.DIMENSIONS ?? []).map((d) => d.subtitle);
  const header = ['姓名', 'Email', '作答時間', '總分', '達成率', '落點等級', '作答次數', ...dimHeaders];
  const data = rows.map((r) => {
    const sub = r._latestSub;
    const dimScores = sub
      ? (activeConfig?.DIMENSIONS ?? []).map((d) => {
          const found = sub.result?.dimensions?.find((x) => x.id === d.id);
          return found ? found.score : '';
        })
      : dimHeaders.map(() => '');
    return [r.name, r.email, formatDate(r.when), r.total, `${r.percent}%`, r.level.badge, r.attempts, ...dimScores];
  });
  buildCsvBlob(
    [header, ...data],
    `${assessmentName ?? 'assessment'}-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

export function exportGroupCsv(group, submissions, users, getAssessment, latestPerUser) {
  const config = getAssessment(group.assessmentId);
  const dimHeaders = (config?.DIMENSIONS ?? []).map((d) => d.subtitle);
  const header = ['姓名', 'Email', '作答時間', '總分', '達成率', '落點等級', ...dimHeaders, '教練評語'];
  const latest = latestPerUser(submissions);
  const data = latest.map((s) => {
    const u = users.find((x) => x.id === s.userId);
    const dims = (config?.DIMENSIONS ?? []).map(
      (d) => s.result?.dimensions?.find((x) => x.id === d.id)?.score ?? '',
    );
    const comment = s.comments?.[0]?.text ?? '';
    return [
      u?.name ?? s.userName,
      u?.email ?? '',
      formatDate(s.createdAt),
      s.result?.total,
      `${s.result?.percent}%`,
      s.result?.level?.badge,
      ...dims,
      comment,
    ];
  });
  buildCsvBlob(
    [header, ...data],
    `${group.name}-成績-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

// 專案範本（Sprint 21-C）：客戶專案開班用的固定組合——評量、附加問卷、是否專屬班級。
// 起因：開班時自己挑評量，容易選錯（森永 360 的班級開在 L9D）。範本由管理員維護；教練開班選範本，
// 評量就鎖定，不能另選、也不能事後改成別份。

const MAX_NAME = 80;
const MAX_NOTES = 500;

/**
 * 清洗並驗證範本欄位。
 * @returns {{template: object} | {error: string}}
 */
export function sanitizeTemplate(body, data) {
  const b = body ?? {};
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > MAX_NAME) return { error: `請輸入範本名稱（最多 ${MAX_NAME} 字）` };
  const clientName = typeof b.clientName === 'string' ? b.clientName.trim().slice(0, MAX_NAME) : '';
  const notes = typeof b.notes === 'string' ? b.notes.trim().slice(0, MAX_NOTES) : '';
  const assessments = data.assessments ?? [];
  const main = assessments.find((a) => a.id === b.assessmentId);
  if (!main || main.classOnly) return { error: '評量不存在，或這份評量只能附加、不能當班級的主要評量' };
  if (!main.enabled) return { error: '這份評量目前未開放，請先在「題庫啟用狀態」啟用' };
  const extra = Array.isArray(b.extraAssessmentIds)
    ? [...new Set(b.extraAssessmentIds)].filter((id) => assessments.some((a) => a.id === id && a.enabled && a.classOnly)).slice(0, 5)
    : [];
  return { template: { name, clientName, assessmentId: main.id, extraAssessmentIds: extra, exclusive: b.exclusive === true, notes } };
}

/** 教練端看到的欄位（不含備註以外的內部資訊）。 */
export const publicTemplate = (t) => ({
  id: t.id, name: t.name, clientName: t.clientName ?? '', assessmentId: t.assessmentId,
  extraAssessmentIds: t.extraAssessmentIds ?? [], exclusive: t.exclusive === true, notes: t.notes ?? '',
});

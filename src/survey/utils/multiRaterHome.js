// 決定 360° 評測頁面實際要顯示的評量 id。
//
// selectedId 可能承接自其他頁面（例如「我的評量」當時選的評量、瀏覽器歷史紀錄殘留的
// 網址參數），不保證仍然支援 360°。必須驗證它確實存在於 supportedAssessments 之中，
// 否則一律退回第一個支援 360 的評量，避免對不支援 360 的評量誤發起評測他人的流程
// （見 2026-07 的 360° 洩漏到 AI 問卷的修復）。
export function resolveActiveAssessmentId(selectedId, supportedAssessments) {
  if (selectedId && supportedAssessments.some((a) => a.id === selectedId)) {
    return selectedId;
  }
  return supportedAssessments[0]?.id ?? null;
}

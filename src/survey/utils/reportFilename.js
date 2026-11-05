// 報告存成 PDF 時的檔名規則（純函式）。
//
// 瀏覽器「列印 → 另存為 PDF」會拿 document.title 當預設檔名，所以報告開啟時把標題設成這裡算出來的名稱，
// 使用者不必自己取名，也不會每個人取得不一樣。
//
// 格式（用底線分段，沒有的段落省略）：
//   [班級或專案名稱]_[評量簡稱]_[報告類型]_[對象]_[產出日期 YYYYMMDD]
//
//   L9D_個人報告_王小明_20261105                       學員自己列印
//   森永高階教練360_L8D_個人報告_潘信諺_20261105        教練在班級內列印
//   森永高階教練360_L8D_360報告_潘信諺_20261105
//   森永高階教練360_L8D_班級報告_20261105
//   森永高階教練360_L8D_個人報告彙整_12人_20261105
//   森永高階教練360_LC_班級組織診斷_課前_20261105
//
// 日期一律是「產出當天」（台灣時間）；同一天重印會是同一個檔名，瀏覽器會自動加（1）。
// 排序時同一個班級的檔案會排在一起，再依評量與報告類型分群。
import { getAssessment } from '../data/assessments/index.js';

export const REPORT_KIND = {
  personal: '個人報告',
  threeSixty: '360報告',
  group: '班級報告',
  batch: '個人報告彙整',
  groupDiagnosis: '班級組織診斷',
};

const MAX_PART = 40;

/** 檔名的一段：拿掉檔案系統不允許的字元、空白改成連字號、限制長度。 */
export function cleanPart(text) {
  return String(text ?? '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\p{Cc}/gu, '') // 控制字元
    .trim()
    .replace(/\s+/g, '-')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, MAX_PART);
}

/** 台灣時間的 YYYYMMDD。 */
export function dateStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  return parts.replaceAll('-', '');
}

/** 評量簡稱：題庫的 ABBR；沒有就用評量 id。 */
export function assessmentAbbr(assessmentId) {
  return getAssessment(assessmentId)?.ABBR ?? assessmentId ?? '';
}

/**
 * @param {object} o
 * @param {string} o.kind 報告類型（REPORT_KIND 的值）
 * @param {string} [o.assessmentId]
 * @param {string} [o.groupName] 班級或專案名稱（有的話放最前面，同一客戶的檔案排在一起）
 * @param {string} [o.subject] 對象（受評者／學員姓名）
 * @param {string} [o.detail] 其他說明（人數、課前課後）
 * @param {Date} [o.date] 產出日期（預設現在）
 * @returns {string} 不含副檔名
 */
export function reportFilename({ kind, assessmentId, groupName, subject, detail, date = new Date() }) {
  const parts = [groupName, assessmentId ? assessmentAbbr(assessmentId) : '', kind, subject, detail, dateStamp(date)]
    .map(cleanPart)
    .filter(Boolean);
  return parts.join('_');
}

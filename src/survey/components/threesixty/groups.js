// 360° 報告圖表的評分者群組：中文名稱與固定顏色。
export const GROUPS = {
  self: { label: '自評', color: '#7c3aed' },
  manager: { label: '主管', color: '#d97706' },
  peer: { label: '同儕', color: '#64748b' },
  subordinate: { label: '部屬', color: '#0284c7' },
  others: { label: '他評合計', color: '#1e293b' },
};
export const GROUP_ORDER = ['self', 'manager', 'peer', 'subordinate', 'others'];

export const RATER_TYPES = ['self', 'manager', 'peer', 'subordinate'];

export const RATER_LABELS = {
  self: '自評',
  manager: '主管',
  peer: '同儕',
  subordinate: '部屬',
  // 嚴格隱私題庫（雙環領導羅盤）的「他評合計」彙整項目；不是可選的評分者類型。
  others: '他評合計',
};

export const RATER_COLORS = {
  self: 'bg-brand-50 text-brand-700 ring-brand-200',
  manager: 'bg-blue-50 text-blue-700 ring-blue-200',
  peer: 'bg-green-50 text-green-700 ring-green-200',
  subordinate: 'bg-purple-50 text-purple-700 ring-purple-200',
  others: 'bg-slate-50 text-slate-700 ring-slate-200',
};

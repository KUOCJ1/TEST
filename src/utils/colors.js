export const EVENT_COLORS = [
  { id: 'blue',   hex: '#3b82f6', label: '藍色' },
  { id: 'indigo', hex: '#6366f1', label: '靛藍' },
  { id: 'violet', hex: '#8b5cf6', label: '紫色' },
  { id: 'green',  hex: '#22c55e', label: '綠色' },
  { id: 'teal',   hex: '#14b8a6', label: '藍綠' },
  { id: 'cyan',   hex: '#06b6d4', label: '青色' },
  { id: 'orange', hex: '#f97316', label: '橘色' },
  { id: 'amber',  hex: '#f59e0b', label: '琥珀' },
  { id: 'red',    hex: '#ef4444', label: '紅色' },
  { id: 'rose',   hex: '#f43f5e', label: '玫瑰' },
  { id: 'pink',   hex: '#ec4899', label: '粉紅' },
  { id: 'slate',  hex: '#64748b', label: '灰色' },
];

export const EVENT_TYPES = [
  { id: 'work',     label: '工作',  defaultColor: 'blue' },
  { id: 'meeting',  label: '會議',  defaultColor: 'violet' },
  { id: 'personal', label: '私人',  defaultColor: 'green' },
  { id: 'reminder', label: '提醒',  defaultColor: 'orange' },
];

export function getColorHex(colorId) {
  return EVENT_COLORS.find(c => c.id === colorId)?.hex ?? '#6366f1';
}

export function getTypeDefaultColor(typeId) {
  return EVENT_TYPES.find(t => t.id === typeId)?.defaultColor ?? 'blue';
}

export const REMINDER_OPTIONS = [
  { value: '',      label: '不提醒' },
  { value: '15',    label: '15 分鐘前' },
  { value: '60',    label: '1 小時前' },
  { value: '1440',  label: '1 天前' },
];

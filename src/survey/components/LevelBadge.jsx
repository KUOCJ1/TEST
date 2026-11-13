import { Sprout, Leaf, TreeDeciduous, Trees } from 'lucide-react';
import { badgeText, stageOf } from '../utils/levelBadge';
import { badgeBg } from '../utils/color';

// 落點徽章：有等級列表的題庫用「成長階段」四種樣式（種子→萌芽→成樹→森林），圖示是 SVG；
// 風格型題庫（DISC 等）沒有高低之分，維持題庫自己的顏色，只去掉 emoji。
const STAGES = [
  { Icon: Sprout, cls: 'bg-brass-50 text-brass-500' },
  { Icon: Leaf, cls: 'bg-ink-700/10 text-ink-700' },
  { Icon: TreeDeciduous, cls: 'bg-ink-700 text-paper-50' },
  { Icon: Trees, cls: 'bg-slate-900 text-brass-200' },
];

export default function LevelBadge({ level, config, size = 'sm', onDark = false, showEn = false, className = '' }) {
  const stage = stageOf(level, config);
  const text = badgeText(level.badge);
  const pad = size === 'lg' ? 'px-4 py-1.5 text-base' : 'px-2.5 py-0.5 text-xs';
  const iconCls = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  if (stage == null) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold text-white ${pad} ${className}`} style={{ background: badgeBg(level.color) }}>
        {text}{showEn && level.badgeEn && <span className="font-normal opacity-90">{level.badgeEn}</span>}
      </span>
    );
  }
  const { Icon, cls } = STAGES[stage];
  // onDark：放在品牌深綠色塊上，用行內顏色（深色模式的全域規則改不到）。
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad} ${onDark ? '' : cls} ${className}`}
      style={onDark ? { background: '#f2b544', color: '#1f2924' } : undefined}
    >
      <Icon className={iconCls} aria-hidden="true" />
      {text}
      {showEn && level.badgeEn && <span className="font-normal opacity-80">{level.badgeEn}</span>}
    </span>
  );
}

import { X } from 'lucide-react';
import { EVENT_COLORS } from '../../utils/colors';

export default function FilterBar({ events, tagFilters, colorFilters, onTagToggle, onColorToggle, onClear }) {
  const allTags = [...new Set(events.flatMap(e => e.tags || []))].sort();
  const hasFilters = tagFilters.length > 0 || colorFilters.length > 0;

  if (allTags.length === 0 && !hasFilters) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-100 flex-wrap shrink-0">
      <span className="text-xs text-slate-400 font-medium shrink-0">篩選</span>

      {/* Color dots */}
      <div className="flex items-center gap-1.5">
        {EVENT_COLORS.map(c => {
          const active = colorFilters.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onColorToggle(c.id)}
              title={c.label}
              style={{ backgroundColor: c.hex }}
              className={`p-1 w-5 h-5 rounded-full transition-all ${
                active
                  ? 'ring-2 ring-offset-1 ring-slate-500 scale-125'
                  : 'opacity-40 hover:opacity-90 hover:scale-110'
              }`}
            />
          );
        })}
      </div>

      {/* Tag pills */}
      {allTags.map(tag => {
        const active = tagFilters.includes(tag);
        return (
          <button
            key={tag}
            onClick={() => onTagToggle(tag)}
            className={`text-xs px-2 py-1 rounded-full transition-colors ${
              active
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            #{tag}
          </button>
        );
      })}

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors ml-1"
        >
          <X size={11} />
          清除
        </button>
      )}
    </div>
  );
}

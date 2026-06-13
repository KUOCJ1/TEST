import { useMemo } from 'react';
import { X } from 'lucide-react';
import { EVENT_COLORS, EVENT_TYPES } from '../../utils/colors';

export default function FilterBar({ events, tagFilters, colorFilters, typeFilters = [], onTagToggle, onColorToggle, onTypeToggle, onClear }) {
  const allTags = useMemo(() => [...new Set(events.flatMap(e => e.tags || []))].sort(), [events]);
  const usedTypes = useMemo(() => [...new Set(events.map(e => e.type).filter(Boolean))], [events]);
  const hasFilters = tagFilters.length > 0 || colorFilters.length > 0 || typeFilters.length > 0;

  if (allTags.length === 0 && usedTypes.length === 0 && !hasFilters) return null;

  return (
    <div role="group" aria-label="事件篩選" className="flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-100 flex-wrap shrink-0">
      <span className="text-xs text-slate-400 font-medium shrink-0">篩選</span>

      {/* Event type pills */}
      {usedTypes.map(typeId => {
        const typeDef = EVENT_TYPES.find(t => t.id === typeId);
        if (!typeDef) return null;
        const active = typeFilters.includes(typeId);
        return (
          <button
            key={typeId}
            onClick={() => onTypeToggle?.(typeId)}
            aria-pressed={active}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              active
                ? 'bg-slate-700 text-white border-slate-700'
                : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
            }`}
          >
            {typeDef.label}
          </button>
        );
      })}

      {/* Separator */}
      {usedTypes.length > 0 && (
        <div className="w-px h-4 bg-slate-200 shrink-0" />
      )}

      {/* Color dots */}
      <div className="flex items-center gap-1.5">
        {EVENT_COLORS.map(c => {
          const active = colorFilters.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onColorToggle(c.id)}
              title={c.label}
              aria-label={`篩選${c.label}${active ? '（已選取）' : ''}`}
              aria-pressed={active}
              style={{ backgroundColor: c.hex }}
              className={`w-4 h-4 rounded-full transition-all ${
                active
                  ? 'ring-2 ring-offset-1 ring-slate-500 scale-125'
                  : 'opacity-30 hover:opacity-80 hover:scale-110'
              }`}
            />
          );
        })}
      </div>

      {/* Tag pills */}
      {allTags.length > 0 && <div className="w-px h-4 bg-slate-200 shrink-0" />}
      {allTags.map(tag => {
        const active = tagFilters.includes(tag);
        return (
          <button
            key={tag}
            onClick={() => onTagToggle(tag)}
            aria-pressed={active}
            aria-label={`篩選標籤 ${tag}${active ? '（已選取）' : ''}`}
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
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors ml-auto"
        >
          <X size={11} />
          清除篩選
        </button>
      )}
    </div>
  );
}

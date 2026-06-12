import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Calendar } from 'lucide-react';
import { getColorHex } from '../../utils/colors';
import { formatDisplayTime } from '../../utils/calendar';

function highlight(text, query) {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-inherit rounded">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function EventSearch({ isOpen, onClose, events, onSelectEvent }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return events
      .filter(e =>
        e.source !== 'google' &&
        (e.title?.toLowerCase().includes(q) ||
         e.description?.toLowerCase().includes(q) ||
         e.tags?.some(t => t.toLowerCase().includes(q)) ||
         e.location?.toLowerCase().includes(q))
      )
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
      .slice(0, 20);
  }, [query, events]);

  // Group results by date
  const grouped = useMemo(() => {
    const map = new Map();
    for (const e of results) {
      const dateKey = new Date(e.startAt).toLocaleDateString('zh-TW', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey).push(e);
    }
    return [...map.entries()];
  }, [results]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜尋事件、地點、標籤..."
            className="flex-1 text-sm outline-none text-slate-800 placeholder-slate-400"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:block text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {query && grouped.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Calendar size={32} className="mb-2 opacity-40" />
              <p className="text-sm">找不到符合的事件</p>
            </div>
          )}

          {!query && (
            <div className="py-8 text-center text-slate-400 text-sm">
              輸入關鍵字搜尋事件
            </div>
          )}

          {grouped.map(([dateLabel, evts]) => (
            <div key={dateLabel}>
              <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 bg-slate-50 border-b border-slate-100">
                {dateLabel}
              </div>
              {evts.map(e => (
                <button
                  key={e.id}
                  onClick={() => { onSelectEvent(e); onClose(); }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 flex items-start gap-3"
                >
                  <div
                    className="w-3 h-3 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: getColorHex(e.color) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {highlight(e.title, query)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {e.isAllDay ? '全天' : `${formatDisplayTime(e.startAt)} – ${formatDisplayTime(e.endAt)}`}
                      {e.location && <span className="ml-2">📍 {highlight(e.location, query)}</span>}
                    </p>
                    {e.description && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">{highlight(e.description, query)}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

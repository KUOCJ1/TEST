import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(-1);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return events
      .filter(e =>
        e.title?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.tags?.some(t => t.toLowerCase().includes(q)) ||
        e.location?.toLowerCase().includes(q)
      )
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
      .slice(0, 25);
  }, [query, events]);

  useEffect(() => { setActiveIndex(-1); }, [results]);

  const selectActive = useCallback(() => {
    if (activeIndex >= 0 && activeIndex < results.length) {
      onSelectEvent(results[activeIndex]);
      onClose();
    }
  }, [activeIndex, results, onSelectEvent, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = e => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => (i >= results.length - 1 ? 0 : i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => (i <= 0 ? results.length - 1 : i - 1));
      } else if (e.key === 'Enter') {
        selectActive();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, results.length, selectActive]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-result]');
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

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

  // Flat index map: result index → (groupIdx, itemIdx)
  let flatIdx = 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="搜尋事件" className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜尋關鍵字、地點、標籤..."
            className="flex-1 text-sm outline-none text-slate-800 placeholder-slate-400"
            aria-label="搜尋關鍵字"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="search-results"
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600" aria-label="清除搜尋">
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:block text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div id="search-results" role="listbox" aria-label="搜尋結果" className="max-h-96 overflow-y-auto" ref={listRef}>
          {query && grouped.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Calendar size={32} className="mb-2 opacity-40" />
              <p className="text-sm">找不到符合的事件</p>
            </div>
          )}

          {!query && (
            <div className="py-8 text-center text-slate-400 text-sm">
              <p>輸入關鍵字搜尋事件</p>
              <p className="text-xs mt-1 text-slate-300">↑↓ 導航  ·  Enter 選取  ·  Esc 關閉</p>
            </div>
          )}

          {grouped.map(([dateLabel, evts]) => (
            <div key={dateLabel}>
              <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 bg-slate-50 border-b border-slate-100 sticky top-0">
                {dateLabel}
              </div>
              {evts.map(e => {
                const idx = flatIdx++;
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={e.id}
                    id={`search-result-${idx}`}
                    data-result={idx}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => { onSelectEvent(e); onClose(); }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full text-left px-4 py-3 transition-colors border-b border-slate-50 last:border-0 flex items-start gap-3 ${
                      isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: getColorHex(e.color) }}
                      />
                      {e.source === 'google' && (
                        <span className="text-[9px] text-slate-400 bg-slate-100 rounded px-1">G</span>
                      )}
                    </div>
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
                    {isActive && (
                      <kbd className="text-[10px] text-slate-300 shrink-0 self-center">↵</kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          <div
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {query ? (results.length > 0 ? `找到 ${results.length} 筆結果` : '找不到符合的事件') : ''}
          </div>
          {results.length > 0 && (
            <div className="px-4 py-2 text-xs text-slate-300 text-right border-t border-slate-50">
              {results.length} 筆結果
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

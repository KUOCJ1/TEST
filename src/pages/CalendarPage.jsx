import { useState, useMemo, useEffect, useCallback } from 'react';
import { Calendar, LogOut, Menu, Settings, Search, LayoutList, CheckSquare, X, Trash2, Download } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { exportToIcs, parseIcs } from '../utils/ics';
import { expandRecurringEvents } from '../utils/recurrence';
import GoogleSettingsModal from '../components/settings/GoogleSettingsModal';
import NotificationCenter from '../components/notifications/NotificationCenter';
import ToastContainer from '../components/notifications/ToastContainer';
import EventSearch from '../components/search/EventSearch';
import AgendaSidebar from '../components/calendar/AgendaSidebar';
import { useAuth } from '../context/AuthContext';
import { useCalendar } from '../context/CalendarContext';
import { useGroups } from '../context/GroupContext';
import CalendarHeader from '../components/calendar/CalendarHeader';
import MonthView from '../components/calendar/MonthView';
import WeekView from '../components/calendar/WeekView';
import DayView from '../components/calendar/DayView';
import FilterBar from '../components/calendar/FilterBar';
import Sidebar from '../components/groups/Sidebar';
import EventModal from '../components/events/EventModal';
import EventDetailModal from '../components/events/EventDetailModal';
import CreateGroupModal from '../components/groups/CreateGroupModal';
import JoinGroupModal from '../components/groups/JoinGroupModal';
import MembersModal from '../components/groups/MembersModal';
import { getWeekStart, getWeekDays, isSameDay } from '../utils/calendar';
import { useIsDesktop } from '../hooks/useIsMobile';

function getViewWindow(view, currentDate) {
  if (view === 'month') {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0, 23, 59, 59);
    return { start, end };
  }
  if (view === 'week') {
    const ws = getWeekStart(currentDate);
    const we = new Date(ws.getTime() + 7 * 86400000);
    return { start: ws, end: we };
  }
  const start = new Date(currentDate); start.setHours(0, 0, 0, 0);
  const end = new Date(currentDate); end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default function CalendarPage() {
  const { currentUser, logout } = useAuth();
  const { events, addEvent, updateEvent, deleteEvent } = useCalendar();
  const { groups, getGroupEvents, refresh } = useGroups();

  // View & navigation
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Group
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filters
  const [tagFilters, setTagFilters] = useState([]);
  const [colorFilters, setColorFilters] = useState([]);
  const [typeFilters, setTypeFilters] = useState([]);

  // Event modal
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  // Detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState(null);

  // Group modals
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [managingGroupId, setManagingGroupId] = useState(null);

  const [showUserMenu, setShowUserMenu] = useState(false);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);

  // Agenda sidebar
  const isDesktop = useIsDesktop();
  const [agendaOpen, setAgendaOpen] = useState(true);

  // Bulk select
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Recurring edit scope dialog
  const [recurScopeDialog, setRecurScopeDialog] = useState(null); // { data, event }

  // Copy template for duplicating an event
  const [copyTemplate, setCopyTemplate] = useState(null);

  // ── Notifications ─────────────────────────────────────────────
  const { permission, requestPermission, upcomingReminders, toasts, addToast, dismissToast } = useNotifications(events);

  // ── Google Calendar ───────────────────────────────────────────
  const googleCalendar = useGoogleCalendar();

  // ── Settings modal ────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);

  // ── Keyboard shortcuts ────────────────────────────────────────
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function handler(e) {
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(o => !o);
        return;
      }
      if (typing) return;

      if (e.key === '?') { setShowHelp(o => !o); return; }
      if (e.key === 'Escape') { setShowHelp(false); return; }
      if (e.key === 't') { goToday(); return; }
      if (e.key === 'n') { handleSlotClick(new Date()); return; }
      if (e.key === 'm') { setView('month'); return; }
      if (e.key === 'w') { setView('week'); return; }
      if (e.key === 'd') { setView('day'); return; }
      if (e.key === 'ArrowLeft') { navigate(-1); return; }
      if (e.key === 'ArrowRight') { navigate(1); return; }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [view]);

  // ── Navigation ───────────────────────────────────────────────
  function navigate(dir) {
    setCurrentDate(d => {
      if (view === 'month') return new Date(d.getFullYear(), d.getMonth() + dir, 1);
      if (view === 'week')  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir * 7);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir);
    });
  }

  function goToday() { setCurrentDate(new Date()); }

  // ── Events ───────────────────────────────────────────────────
  const rawEvents = activeGroupId ? getGroupEvents(activeGroupId) : events;

  const displayEvents = useMemo(() => {
    let result = rawEvents;
    if (colorFilters.length > 0) result = result.filter(e => colorFilters.includes(e.color));
    if (tagFilters.length > 0)   result = result.filter(e => tagFilters.some(t => e.tags?.includes(t)));
    if (typeFilters.length > 0)  result = result.filter(e => typeFilters.includes(e.type));

    // Expand recurring events within the current view window
    const { start, end } = getViewWindow(view, currentDate);
    result = expandRecurringEvents(result, start, end);

    // Merge Google Calendar events
    const googleVisible = googleCalendar.isConnected ? googleCalendar.googleEvents : [];
    return [...result, ...googleVisible];
  }, [rawEvents, colorFilters, tagFilters, typeFilters, view, currentDate, googleCalendar.isConnected, googleCalendar.googleEvents]);

  const activeGroupName = activeGroupId ? groups.find(g => g.id === activeGroupId)?.name : null;

  // ── Document title with today's event count ───────────────────
  useEffect(() => {
    const today = new Date();
    const todayCount = rawEvents.filter(e => {
      const s = new Date(e.startAt);
      return s.getFullYear() === today.getFullYear() &&
             s.getMonth()    === today.getMonth()    &&
             s.getDate()     === today.getDate();
    }).length;
    document.title = todayCount > 0 ? `(${todayCount}) 共享行事曆` : '共享行事曆';
    return () => { document.title = '共享行事曆'; };
  }, [rawEvents]);

  // ── Event click handlers ─────────────────────────────────────
  function handleEventClick(event) {
    if (event.source === 'google') {
      setDetailEvent(event);
      setDetailModalOpen(true);
      return;
    }
    if (event.creatorId === currentUser.id) {
      // For recurring instances: edit the base event
      const baseId = event.recurringBaseId || event.id;
      const baseEvent = events.find(e => e.id === baseId) || event;
      setSelectedEvent(baseEvent);
      setSelectedDate(null);
      setEventModalOpen(true);
    } else {
      setDetailEvent(event);
      setDetailModalOpen(true);
    }
  }

  function handleSlotClick(date) {
    if (selectMode) return;
    setSelectedEvent(null);
    setSelectedDate(date);
    setEventModalOpen(true);
  }

  function closeEventModal() {
    setEventModalOpen(false);
    setSelectedEvent(null);
    setSelectedDate(null);
    setCopyTemplate(null);
  }

  function handleSave(data) {
    if (selectedEvent) {
      if (selectedEvent.isRecurring) {
        setRecurScopeDialog({ data, event: selectedEvent });
        closeEventModal();
        return;
      }
      updateEvent(selectedEvent.id, data);
      addToast({ type: 'success', title: '事件已更新', body: data.title });
    } else {
      addEvent(data);
      addToast({ type: 'success', title: '事件已新增', body: data.title });
    }
    closeEventModal();
  }

  function applyRecurScope(scope) {
    if (!recurScopeDialog) return;
    const { data, event } = recurScopeDialog;
    setRecurScopeDialog(null);
    if (scope === 'this') {
      updateEvent(event.id, data);
    } else if (scope === 'future') {
      events
        .filter(e => e.recurringBaseId === event.recurringBaseId && new Date(e.startAt) >= new Date(event.startAt))
        .forEach(e => {
          const diff = new Date(data.startAt).getTime() - new Date(event.startAt).getTime();
          const dur = new Date(data.endAt).getTime() - new Date(data.startAt).getTime();
          updateEvent(e.id, {
            ...data,
            startAt: new Date(new Date(e.startAt).getTime() + diff).toISOString(),
            endAt:   new Date(new Date(e.startAt).getTime() + diff + dur).toISOString(),
          });
        });
    } else {
      events
        .filter(e => e.recurringBaseId === event.recurringBaseId)
        .forEach(e => {
          const diff = new Date(data.startAt).getTime() - new Date(event.startAt).getTime();
          const dur = new Date(data.endAt).getTime() - new Date(data.startAt).getTime();
          updateEvent(e.id, {
            ...data,
            startAt: new Date(new Date(e.startAt).getTime() + diff).toISOString(),
            endAt:   new Date(new Date(e.startAt).getTime() + diff + dur).toISOString(),
          });
        });
    }
    addToast({ type: 'success', title: '事件已更新', body: data.title });
  }

  function handleDelete(id) {
    const evt = events.find(e => e.id === id);
    closeEventModal();
    if (evt?.isRecurring) {
      setRecurScopeDialog({ data: null, event: evt, isDelete: true });
      return;
    }
    deleteEvent(id);
    if (evt) addToast({ type: 'info', title: '事件已刪除', body: evt.title });
  }

  function applyRecurDeleteScope(scope) {
    if (!recurScopeDialog) return;
    const { event } = recurScopeDialog;
    setRecurScopeDialog(null);
    if (scope === 'this') {
      deleteEvent(event.id);
    } else if (scope === 'future') {
      events
        .filter(e => e.recurringBaseId === event.recurringBaseId && new Date(e.startAt) >= new Date(event.startAt))
        .forEach(e => deleteEvent(e.id));
    } else {
      events
        .filter(e => e.recurringBaseId === event.recurringBaseId)
        .forEach(e => deleteEvent(e.id));
    }
    addToast({ type: 'info', title: '事件已刪除', body: event.title });
  }

  // ── Drag-and-drop (MonthView: day-level) ─────────────────────
  const handleMoveEvent = useCallback((eventId, originalDate, targetDate) => {
    const evt = events.find(e => e.id === eventId);
    if (!evt || isSameDay(originalDate, targetDate)) return;
    const diff = targetDate.getTime() - new Date(originalDate).getTime();
    const newStart = new Date(new Date(evt.startAt).getTime() + diff);
    const newEnd   = new Date(new Date(evt.endAt).getTime() + diff);
    updateEvent(eventId, { ...evt, startAt: newStart.toISOString(), endAt: newEnd.toISOString() });
    addToast({ type: 'success', title: '已移動事件', body: evt.title });
  }, [events, updateEvent, addToast]);

  // ── Drag-and-drop (WeekView/DayView: time-level) ─────────────
  const handleMoveEventToTime = useCallback((eventId, newStartAt, newEndAt) => {
    const evt = events.find(e => e.id === eventId);
    if (!evt) return;
    updateEvent(eventId, { ...evt, startAt: newStartAt, endAt: newEndAt });
    addToast({ type: 'success', title: '已移動事件', body: evt.title });
  }, [events, updateEvent, addToast]);

  // ── Bulk select ──────────────────────────────────────────────
  function toggleSelectMode() {
    setSelectMode(m => !m);
    setSelectedIds(new Set());
  }

  function toggleSelectId(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function deleteSelected() {
    if (!selectedIds.size) return;
    const count = selectedIds.size;
    selectedIds.forEach(id => deleteEvent(id));
    setSelectedIds(new Set());
    setSelectMode(false);
    addToast({ type: 'info', title: `已刪除 ${count} 個事件` });
  }

  function selectAll() {
    const visibleIds = displayEvents
      .filter(e => e.source !== 'google' && !e.isRecurring)
      .map(e => e.id);
    setSelectedIds(new Set(visibleIds));
  }

  function exportSelected() {
    const toExport = events.filter(e => selectedIds.has(e.id));
    if (!toExport.length) return;
    const content = exportToIcs(toExport);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '已選取事件.ics';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Filter handlers ──────────────────────────────────────────
  function toggleTag(tag) {
    setTagFilters(f => f.includes(tag) ? f.filter(t => t !== tag) : [...f, tag]);
  }

  function toggleColor(color) {
    setColorFilters(f => f.includes(color) ? f.filter(c => c !== color) : [...f, color]);
  }

  function toggleType(type) {
    setTypeFilters(f => f.includes(type) ? f.filter(t => t !== type) : [...f, type]);
  }

  function clearFilters() {
    setTagFilters([]);
    setColorFilters([]);
    setTypeFilters([]);
  }

  // ── Group handlers ────────────────────────────────────────────
  function handleGroupLeft() {
    setActiveGroupId(null);
    refresh();
  }

  function handleEditFromDetail() {
    setDetailModalOpen(false);
    setSelectedEvent(detailEvent);
    setDetailEvent(null);
    setEventModalOpen(true);
  }

  function handleCopyFromDetail() {
    if (!detailEvent) return;
    // eslint-disable-next-line no-unused-vars
    const { id, creatorId, recurringBaseId, isRecurring, source, ...rest } = detailEvent;
    setDetailModalOpen(false);
    setDetailEvent(null);
    setCopyTemplate(rest);
    setSelectedEvent(null);
    setEventModalOpen(true);
  }

  // ── Search handler ────────────────────────────────────────────
  function handleSearchSelect(event) {
    setCurrentDate(new Date(event.startAt));
    setView('day');
    setDetailEvent(event);
    setDetailModalOpen(true);
  }

  // ── ICS export/import ─────────────────────────────────────────
  function handleExportIcs() {
    const content = exportToIcs(events);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '行事曆.ics';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportIcs(text) {
    const parsed = parseIcs(text);
    let count = 0;
    for (const e of parsed) {
      if (e.externalId && events.some(ev => ev.externalId === e.externalId)) continue;
      addEvent({ ...e, title: e.title || '匯入事件' });
      count++;
    }
    addToast({ type: 'success', title: '匯入完成', body: `成功匯入 ${count} 個事件` });
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Top nav */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white shadow-sm z-20 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors lg:hidden"
          >
            <Menu size={18} />
          </button>
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Calendar size={15} className="text-white" />
          </div>
          <span className="font-semibold text-slate-800 text-sm shrink-0">共享行事曆</span>
          {activeGroupName && (
            <>
              <span className="text-slate-300 text-sm">/</span>
              <span className="text-sm text-indigo-600 font-medium truncate">{activeGroupName}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex flex-col items-center p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="搜尋"
            title="搜尋 (Ctrl+K)"
          >
            <Search size={18} />
            <span className="text-[10px] leading-none mt-0.5 sm:hidden">搜尋</span>
          </button>

          {/* Agenda sidebar toggle (desktop only) */}
          <button
            onClick={() => setAgendaOpen(o => !o)}
            className={`hidden lg:flex flex-col items-center p-1.5 rounded-lg transition-colors ${
              agendaOpen ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-100'
            }`}
            aria-label="議程"
            title="未來 7 天"
          >
            <LayoutList size={18} />
          </button>

          {/* Bulk select toggle */}
          <button
            onClick={toggleSelectMode}
            className={`flex flex-col items-center p-1.5 rounded-lg transition-colors ${
              selectMode ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-100'
            }`}
            aria-label="選取模式"
            title="選取模式"
          >
            <CheckSquare size={18} />
            <span className="text-[10px] leading-none mt-0.5 sm:hidden">選取</span>
          </button>

          {/* Keyboard help */}
          <button
            onClick={() => setShowHelp(true)}
            className="hidden sm:flex flex-col items-center p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="鍵盤快捷鍵"
            title="鍵盤快捷鍵 (?)"
          >
            <span className="text-sm font-medium leading-none">?</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="flex flex-col items-center p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="設定"
          >
            <Settings size={18} />
            <span className="text-[10px] leading-none mt-0.5 sm:hidden">設定</span>
          </button>

          <NotificationCenter
            permission={permission}
            requestPermission={requestPermission}
            upcomingReminders={upcomingReminders}
          />

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(m => !m)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-semibold">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-slate-700 hidden sm:block">{currentUser.name}</span>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-44 z-20">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-800">{currentUser.name}</p>
                    <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); logout(); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <LogOut size={14} />
                    登出
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Bulk action bar */}
      {selectMode && (
        <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 border-b border-indigo-100 text-sm shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-indigo-700 font-medium">
              {selectedIds.size > 0 ? `已選取 ${selectedIds.size} 個事件` : '點擊事件以選取'}
            </span>
            <button
              onClick={selectAll}
              className="text-xs text-indigo-500 hover:text-indigo-700 underline"
            >
              全選
            </button>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={exportSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  <Download size={13} />
                  匯出
                </button>
                <button
                  onClick={deleteSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={13} />
                  刪除
                </button>
              </>
            )}
            <button
              onClick={toggleSelectMode}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={13} />
              取消
            </button>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar (groups) */}
        <Sidebar
          groups={groups}
          activeGroupId={activeGroupId}
          onSelectPersonal={() => setActiveGroupId(null)}
          onSelectGroup={setActiveGroupId}
          onCreateGroup={() => setShowCreateGroup(true)}
          onJoinGroup={() => setShowJoinGroup(true)}
          onManageGroup={id => setManagingGroupId(id)}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Calendar column */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <CalendarHeader
            currentDate={currentDate}
            view={view}
            onPrev={() => navigate(-1)}
            onNext={() => navigate(1)}
            onToday={goToday}
            onViewChange={setView}
            onAddEvent={() => handleSlotClick(new Date())}
            onNavigate={setCurrentDate}
          />

          <FilterBar
            events={rawEvents}
            tagFilters={tagFilters}
            colorFilters={colorFilters}
            typeFilters={typeFilters}
            onTagToggle={toggleTag}
            onColorToggle={toggleColor}
            onTypeToggle={toggleType}
            onClear={clearFilters}
          />

          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              events={displayEvents}
              onDayClick={handleSlotClick}
              onEventClick={handleEventClick}
              currentUserId={currentUser.id}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelectId}
              onMoveEvent={handleMoveEvent}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              events={displayEvents}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
              onMoveEvent={handleMoveEventToTime}
              currentUserId={currentUser.id}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              events={displayEvents}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
              onMoveEvent={handleMoveEventToTime}
              currentUserId={currentUser.id}
            />
          )}
        </div>

        {/* Agenda sidebar (right, desktop only) */}
        {isDesktop && agendaOpen && (
          <AgendaSidebar
            events={displayEvents.filter(e => e.source !== 'google')}
            onEventClick={handleEventClick}
          />
        )}
      </div>

      {/* Modals */}
      <EventModal
        isOpen={eventModalOpen}
        onClose={closeEventModal}
        onSave={handleSave}
        onDelete={handleDelete}
        event={selectedEvent}
        initialDate={selectedDate}
        copyFrom={copyTemplate}
      />

      <EventDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        event={detailEvent}
        onEdit={detailEvent?.creatorId === currentUser.id && detailEvent?.source !== 'google' ? handleEditFromDetail : null}
        onCopy={detailEvent?.source !== 'google' ? handleCopyFromDetail : null}
      />

      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={g => {
          setActiveGroupId(g.id);
          addToast({ type: 'success', title: '已建立群組', body: g.name });
        }}
      />

      <JoinGroupModal
        isOpen={showJoinGroup}
        onClose={() => setShowJoinGroup(false)}
        onJoined={g => {
          setActiveGroupId(g.id);
          addToast({ type: 'success', title: '已加入群組', body: g.name });
        }}
      />

      {managingGroupId && (
        <MembersModal
          isOpen
          onClose={() => setManagingGroupId(null)}
          groupId={managingGroupId}
          currentUserId={currentUser.id}
          onLeft={handleGroupLeft}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <GoogleSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        isConnected={googleCalendar.isConnected}
        isLoading={googleCalendar.isLoading}
        error={googleCalendar.error}
        scriptsReady={googleCalendar.scriptsReady}
        clientId={googleCalendar.clientId}
        connect={googleCalendar.connect}
        disconnect={googleCalendar.disconnect}
        events={events}
        addEvent={addEvent}
        onExportIcs={handleExportIcs}
        onImportIcs={handleImportIcs}
      />

      <EventSearch
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        events={rawEvents}
        onSelectEvent={handleSearchSelect}
      />

      {/* Keyboard shortcuts help */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowHelp(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-800">鍵盤快捷鍵</h3>
              <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-2.5 text-sm">
              {[
                ['Ctrl+K', '開啟搜尋'],
                ['←  /  →', '上 / 下一個時段'],
                ['T', '回到今天'],
                ['N', '新增事件'],
                ['M', '月視圖'],
                ['W', '週視圖'],
                ['D', '日視圖'],
                ['?', '顯示 / 隱藏快捷鍵'],
                ['Esc', '關閉浮層'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-slate-500">{desc}</span>
                  <kbd className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-mono">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recurring edit/delete scope dialog */}
      {recurScopeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRecurScopeDialog(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-base font-semibold text-slate-800">
                {recurScopeDialog.isDelete ? '刪除重複事件' : '編輯重複事件'}
              </h3>
              <p className="text-sm text-slate-500 mt-1">要修改哪些重複事件？</p>
            </div>
            <div className="px-5 pb-5 flex flex-col gap-2">
              {[
                { scope: 'this',   label: '只此活動' },
                { scope: 'future', label: '此活動及以後' },
                { scope: 'all',    label: '全部重複活動' },
              ].map(({ scope, label }) => (
                <button
                  key={scope}
                  onClick={() => recurScopeDialog.isDelete ? applyRecurDeleteScope(scope) : applyRecurScope(scope)}
                  className="w-full text-left px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => setRecurScopeDialog(null)}
                className="w-full text-center px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

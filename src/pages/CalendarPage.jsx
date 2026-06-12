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
  const [agendaOpen, setAgendaOpen] = useState(true);

  // Bulk select
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // ── Notifications ─────────────────────────────────────────────
  const { permission, requestPermission, upcomingReminders, toasts, dismissToast } = useNotifications(events);

  // ── Google Calendar ───────────────────────────────────────────
  const googleCalendar = useGoogleCalendar();

  // ── Settings modal ────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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

    // Expand recurring events within the current view window
    const { start, end } = getViewWindow(view, currentDate);
    result = expandRecurringEvents(result, start, end);

    // Merge Google Calendar events
    const googleVisible = googleCalendar.isConnected ? googleCalendar.googleEvents : [];
    return [...result, ...googleVisible];
  }, [rawEvents, colorFilters, tagFilters, view, currentDate, googleCalendar.isConnected, googleCalendar.googleEvents]);

  const activeGroupName = activeGroupId ? groups.find(g => g.id === activeGroupId)?.name : null;

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
  }

  function handleSave(data) {
    if (selectedEvent) updateEvent(selectedEvent.id, data);
    else addEvent(data);
    closeEventModal();
  }

  function handleDelete(id) {
    if (confirm('確定要刪除這個事件嗎？')) {
      deleteEvent(id);
      closeEventModal();
    }
  }

  // ── Drag-and-drop (MonthView) ─────────────────────────────────
  const handleMoveEvent = useCallback((eventId, originalDate, targetDate) => {
    const evt = events.find(e => e.id === eventId);
    if (!evt || isSameDay(originalDate, targetDate)) return;
    const diff = targetDate.getTime() - new Date(originalDate).getTime();
    const newStart = new Date(new Date(evt.startAt).getTime() + diff);
    const newEnd   = new Date(new Date(evt.endAt).getTime() + diff);
    updateEvent(eventId, { ...evt, startAt: newStart.toISOString(), endAt: newEnd.toISOString() });
  }, [events, updateEvent]);

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
    if (!confirm(`確定要刪除選取的 ${selectedIds.size} 個事件嗎？`)) return;
    selectedIds.forEach(id => deleteEvent(id));
    setSelectedIds(new Set());
    setSelectMode(false);
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

  function clearFilters() {
    setTagFilters([]);
    setColorFilters([]);
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
    alert(`成功匯入 ${count} 個事件`);
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
            onViewChange={v => { setView(v); goToday(); }}
            onAddEvent={() => handleSlotClick(new Date())}
          />

          <FilterBar
            events={rawEvents}
            tagFilters={tagFilters}
            colorFilters={colorFilters}
            onTagToggle={toggleTag}
            onColorToggle={toggleColor}
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
              currentUserId={currentUser.id}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              events={displayEvents}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
              currentUserId={currentUser.id}
            />
          )}
        </div>

        {/* Agenda sidebar (right, desktop only) */}
        {agendaOpen && (
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
      />

      <EventDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        event={detailEvent}
        onEdit={detailEvent?.creatorId === currentUser.id && detailEvent?.source !== 'google' ? handleEditFromDetail : null}
      />

      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={g => setActiveGroupId(g.id)}
      />

      <JoinGroupModal
        isOpen={showJoinGroup}
        onClose={() => setShowJoinGroup(false)}
        onJoined={g => setActiveGroupId(g.id)}
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
    </div>
  );
}

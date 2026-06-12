import { useState, useMemo } from 'react';
import { Calendar, LogOut, Menu, Settings } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { exportToIcs, parseIcs } from '../utils/ics';
import GoogleSettingsModal from '../components/settings/GoogleSettingsModal';
import NotificationCenter from '../components/notifications/NotificationCenter';
import ToastContainer from '../components/notifications/ToastContainer';
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
import { getWeekStart, getWeekDays } from '../utils/calendar';

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

  // ── Notifications ─────────────────────────────────────────────
  const { permission, requestPermission, upcomingReminders, toasts, dismissToast } = useNotifications(events);

  // ── Google Calendar ───────────────────────────────────────────
  const googleCalendar = useGoogleCalendar();

  // ── Settings modal ────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);

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
    // Merge Google Calendar events (read-only, not filtered by local filters)
    const googleVisible = googleCalendar.isConnected ? googleCalendar.googleEvents : [];
    return [...result, ...googleVisible];
  }, [rawEvents, colorFilters, tagFilters, googleCalendar.isConnected, googleCalendar.googleEvents]);

  const activeGroupName = activeGroupId ? groups.find(g => g.id === activeGroupId)?.name : null;

  // ── Event click handlers ─────────────────────────────────────
  function handleEventClick(event) {
    if (event.source === 'google') {
      setDetailEvent(event);
      setDetailModalOpen(true);
      return;
    }
    if (event.creatorId === currentUser.id) {
      setSelectedEvent(event);
      setSelectedDate(null);
      setEventModalOpen(true);
    } else {
      setDetailEvent(event);
      setDetailModalOpen(true);
    }
  }

  function handleSlotClick(date) {
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
      // avoid duplicates by checking externalId
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

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
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
    </div>
  );
}

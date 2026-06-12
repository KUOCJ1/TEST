import { useState } from 'react';
import { Calendar, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCalendar } from '../context/CalendarContext';
import { useGroups } from '../context/GroupContext';
import CalendarHeader from '../components/calendar/CalendarHeader';
import MonthView from '../components/calendar/MonthView';
import Sidebar from '../components/groups/Sidebar';
import EventModal from '../components/events/EventModal';
import EventDetailModal from '../components/events/EventDetailModal';
import CreateGroupModal from '../components/groups/CreateGroupModal';
import JoinGroupModal from '../components/groups/JoinGroupModal';
import MembersModal from '../components/groups/MembersModal';

export default function CalendarPage() {
  const { currentUser, logout } = useAuth();
  const { events, addEvent, updateEvent, deleteEvent } = useCalendar();
  const { groups, getGroupEvents, refresh } = useGroups();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Event modal (create/edit own events)
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  // Detail modal (read-only view for other users' events)
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState(null);

  // Group modals
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [managingGroupId, setManagingGroupId] = useState(null);

  const [showUserMenu, setShowUserMenu] = useState(false);

  // ── Calendar navigation ──────────────────────────────────────
  const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // ── Active events ────────────────────────────────────────────
  const displayEvents = activeGroupId ? getGroupEvents(activeGroupId) : events;

  const activeGroupName = activeGroupId
    ? groups.find(g => g.id === activeGroupId)?.name
    : null;

  // ── Event modal handlers ─────────────────────────────────────
  function handleDayClick(date) {
    // In group view, clicking a day still creates a personal event
    setSelectedEvent(null);
    setSelectedDate(date);
    setEventModalOpen(true);
  }

  function handleEventClick(event) {
    const isOwn = event.creatorId === currentUser.id;
    if (isOwn) {
      setSelectedEvent(event);
      setSelectedDate(null);
      setEventModalOpen(true);
    } else {
      setDetailEvent(event);
      setDetailModalOpen(true);
    }
  }

  function closeEventModal() {
    setEventModalOpen(false);
    setSelectedEvent(null);
    setSelectedDate(null);
  }

  function handleSave(data) {
    if (selectedEvent) {
      updateEvent(selectedEvent.id, data);
    } else {
      addEvent(data);
    }
    closeEventModal();
  }

  function handleDelete(id) {
    if (confirm('確定要刪除這個事件嗎？')) {
      deleteEvent(id);
      closeEventModal();
    }
  }

  // ── Group handlers ────────────────────────────────────────────
  function handleGroupCreated(group) {
    setActiveGroupId(group.id);
  }

  function handleGroupJoined(group) {
    setActiveGroupId(group.id);
  }

  function handleGroupLeft() {
    setActiveGroupId(null);
    refresh();
  }

  // ── Edit from detail modal ────────────────────────────────────
  function handleEditFromDetail() {
    setDetailModalOpen(false);
    setSelectedEvent(detailEvent);
    setDetailEvent(null);
    setSelectedDate(null);
    setEventModalOpen(true);
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Top nav */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white shadow-sm z-20 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors lg:hidden"
          >
            <Menu size={18} />
          </button>
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Calendar size={15} className="text-white" />
          </div>
          <span className="font-semibold text-slate-800 text-sm">共享行事曆</span>
          {activeGroupName && (
            <>
              <span className="text-slate-300 text-sm">/</span>
              <span className="text-sm text-indigo-600 font-medium">{activeGroupName}</span>
            </>
          )}
        </div>

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
      </header>

      {/* Main area */}
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

        {/* Calendar area */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <CalendarHeader
            currentDate={currentDate}
            onPrev={prevMonth}
            onNext={nextMonth}
            onToday={goToday}
            onAddEvent={() => handleDayClick(new Date())}
          />
          <MonthView
            currentDate={currentDate}
            events={displayEvents}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
            currentUserId={currentUser.id}
          />
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
        onEdit={detailEvent?.creatorId === currentUser.id ? handleEditFromDetail : null}
      />

      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={handleGroupCreated}
      />

      <JoinGroupModal
        isOpen={showJoinGroup}
        onClose={() => setShowJoinGroup(false)}
        onJoined={handleGroupJoined}
      />

      {managingGroupId && (
        <MembersModal
          isOpen={!!managingGroupId}
          onClose={() => setManagingGroupId(null)}
          groupId={managingGroupId}
          currentUserId={currentUser.id}
          onLeft={handleGroupLeft}
        />
      )}
    </div>
  );
}

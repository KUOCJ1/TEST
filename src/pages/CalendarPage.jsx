import { useState } from 'react';
import { Calendar, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCalendar } from '../context/CalendarContext';
import CalendarHeader from '../components/calendar/CalendarHeader';
import MonthView from '../components/calendar/MonthView';
import EventModal from '../components/events/EventModal';

export default function CalendarPage() {
  const { currentUser, logout } = useAuth();
  const { events, addEvent, updateEvent, deleteEvent } = useCalendar();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  function prevMonth() {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  function openAddModal(date) {
    setSelectedEvent(null);
    setSelectedDate(date || new Date());
    setModalOpen(true);
  }

  function openEditModal(event) {
    setSelectedEvent(event);
    setSelectedDate(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedEvent(null);
    setSelectedDate(null);
  }

  function handleSave(data) {
    if (selectedEvent) {
      updateEvent(selectedEvent.id, data);
    } else {
      addEvent(data);
    }
    closeModal();
  }

  function handleDelete(id) {
    if (confirm('確定要刪除這個事件嗎？')) {
      deleteEvent(id);
      closeModal();
    }
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Top nav */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shadow-sm z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Calendar size={16} className="text-white" />
          </div>
          <span className="font-semibold text-slate-800">共享行事曆</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(m => !m)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-semibold">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-slate-700 hidden sm:block">{currentUser.name}</span>
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-48 z-20">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-800">{currentUser.name}</p>
                  <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); logout(); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <LogOut size={15} />
                  登出
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Calendar header */}
      <CalendarHeader
        currentDate={currentDate}
        onPrev={prevMonth}
        onNext={nextMonth}
        onToday={goToday}
        onAddEvent={() => openAddModal(null)}
      />

      {/* Month view */}
      <MonthView
        currentDate={currentDate}
        events={events}
        onDayClick={openAddModal}
        onEventClick={openEditModal}
      />

      {/* Event modal */}
      <EventModal
        isOpen={modalOpen}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={handleDelete}
        event={selectedEvent}
        initialDate={selectedDate}
      />
    </div>
  );
}

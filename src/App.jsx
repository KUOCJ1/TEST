import { useState } from 'react';
import { Map, UtensilsCrossed, Info, Heart } from 'lucide-react';

import Header from './components/Header';
import ItineraryTab from './components/ItineraryTab';
import DiningTab from './components/DiningTab';
import TravelInfoTab from './components/TravelInfoTab';
import FavoritesTab from './components/FavoritesTab';

import { itinerary, restaurants, travelInfo } from './data/tokyo';
import { useFavorites } from './hooks/useFavorites';

const TABS = [
  { id: 'itinerary', label: '行程', icon: Map },
  { id: 'dining', label: '美食', icon: UtensilsCrossed },
  { id: 'info', label: '旅遊資訊', icon: Info },
  { id: 'favorites', label: '收藏', icon: Heart },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('itinerary');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, toggleFavorite, isFavorite] = useFavorites('tokyo-travel-favorites');

  const favCount = favorites.length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-2xl mx-auto shadow-xl">
      <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      {/* Desktop tab bar */}
      <nav className="hidden sm:flex bg-white border-b border-slate-200 sticky top-[73px] z-40">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors relative ${
              activeTab === id
                ? 'text-sakura-600 border-b-2 border-sakura-500'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={15} />
            {label}
            {id === 'favorites' && favCount > 0 && (
              <span className="absolute top-1.5 right-3 text-[10px] bg-sakura-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {favCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 pb-20 sm:pb-4 overflow-y-auto">
        {activeTab === 'itinerary' && (
          <ItineraryTab
            itinerary={itinerary}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
            searchQuery={searchQuery}
          />
        )}
        {activeTab === 'dining' && (
          <DiningTab
            restaurants={restaurants}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
            searchQuery={searchQuery}
          />
        )}
        {activeTab === 'info' && <TravelInfoTab travelInfo={travelInfo} />}
        {activeTab === 'favorites' && (
          <FavoritesTab
            itinerary={itinerary}
            restaurants={restaurants}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
          />
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white border-t border-slate-200 z-50 flex shadow-lg">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors relative ${
              activeTab === id ? 'text-sakura-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon size={20} strokeWidth={activeTab === id ? 2.5 : 1.8} />
            {label}
            {id === 'favorites' && favCount > 0 && (
              <span className="absolute top-1 right-[18%] text-[9px] bg-sakura-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                {favCount}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

import { Search, MapPin } from 'lucide-react';

export default function Header({ searchQuery, onSearchChange }) {
  return (
    <header className="bg-gradient-to-r from-sakura-500 to-sakura-600 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <MapPin size={20} className="shrink-0" />
          <h1 className="text-lg font-bold tracking-wide">東京旅遊攻略</h1>
          <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">🌸 5天行程</span>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-sakura-300" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜尋景點、餐廳、資訊..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/15 placeholder-white/60 text-white text-sm focus:outline-none focus:bg-white/25 transition-colors"
          />
        </div>
      </div>
    </header>
  );
}

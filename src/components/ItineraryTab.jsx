import { useState } from 'react';
import { MapPin, Clock, Heart, ExternalLink, Lightbulb } from 'lucide-react';

const TAG_COLORS = {
  文化: 'bg-amber-100 text-amber-700',
  自然: 'bg-green-100 text-green-700',
  購物: 'bg-pink-100 text-pink-700',
  夜生活: 'bg-purple-100 text-purple-700',
  地標: 'bg-blue-100 text-blue-700',
  散步: 'bg-teal-100 text-teal-700',
  藝術: 'bg-orange-100 text-orange-700',
  美食: 'bg-red-100 text-red-700',
};

function mapsUrl(spot) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name + ' ' + spot.address)}`;
}

export default function ItineraryTab({ itinerary, isFavorite, toggleFavorite, searchQuery }) {
  const [activeDay, setActiveDay] = useState(1);

  const q = searchQuery.trim().toLowerCase();

  // If searching, show all matching spots across all days
  if (q) {
    const results = itinerary.flatMap((day) =>
      day.spots
        .filter((s) => s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q))
        .map((s) => ({ ...s, dayNum: day.day, dayTheme: day.theme }))
    );
    return (
      <div className="tab-content p-4 space-y-3">
        <p className="text-sm text-slate-500">找到 {results.length} 個景點</p>
        {results.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <MapPin size={40} className="mx-auto mb-2 opacity-30" />
            <p>找不到相關景點</p>
          </div>
        )}
        {results.map((s) => (
          <SpotCard key={s.id} spot={s} dayLabel={`Day ${s.dayNum}`} isFavorite={isFavorite} toggleFavorite={toggleFavorite} />
        ))}
      </div>
    );
  }

  const day = itinerary.find((d) => d.day === activeDay);

  return (
    <div className="tab-content">
      {/* Day selector */}
      <div className="flex overflow-x-auto gap-2 px-4 py-3 bg-white border-b border-slate-100 no-scrollbar">
        {itinerary.map((d) => (
          <button
            key={d.day}
            onClick={() => setActiveDay(d.day)}
            className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              activeDay === d.day
                ? 'bg-sakura-500 text-white shadow-md shadow-sakura-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className="font-bold">Day {d.day}</span>
            <span className="mt-0.5 opacity-80 max-w-[56px] truncate">{d.theme.split('・')[0]}</span>
          </button>
        ))}
      </div>

      {/* Day header */}
      {day && (
        <div className="px-4 py-3 bg-gradient-to-r from-sakura-50 to-white border-b border-sakura-100">
          <p className="text-xs text-sakura-400 font-medium">第 {day.day} 天</p>
          <h2 className="text-base font-bold text-slate-700">{day.theme}</h2>
        </div>
      )}

      {/* Spot cards */}
      <div className="p-4 space-y-3">
        {day?.spots.map((spot) => (
          <SpotCard key={spot.id} spot={spot} isFavorite={isFavorite} toggleFavorite={toggleFavorite} />
        ))}
      </div>
    </div>
  );
}

function SpotCard({ spot, dayLabel, isFavorite, toggleFavorite }) {
  const [showTip, setShowTip] = useState(false);
  const fav = isFavorite(spot.id);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {dayLabel && (
                <span className="text-xs bg-tokyoBlue-100 text-tokyoBlue-600 px-2 py-0.5 rounded-full font-medium">
                  {dayLabel}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[spot.tag] || 'bg-slate-100 text-slate-600'}`}>
                {spot.tag}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-800 mt-1">{spot.name}</h3>
          </div>
          <button
            onClick={() => toggleFavorite(spot.id)}
            className={`shrink-0 p-1.5 rounded-full transition-colors ${fav ? 'text-sakura-500' : 'text-slate-300 hover:text-sakura-400'}`}
            aria-label={fav ? '取消收藏' : '加入收藏'}
          >
            <Heart size={18} fill={fav ? 'currentColor' : 'none'} />
          </button>
        </div>

        <p className="text-sm text-slate-500 leading-relaxed mb-3">{spot.desc}</p>

        <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {spot.duration}
          </span>
          <span className="flex items-center gap-1 min-w-0">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{spot.address}</span>
          </span>
        </div>

        <div className="flex gap-2">
          <a
            href={mapsUrl(spot)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs bg-tokyoBlue-500 text-white px-3 py-1.5 rounded-lg hover:bg-tokyoBlue-600 transition-colors"
          >
            <ExternalLink size={12} />
            Google Maps
          </a>
          <button
            onClick={() => setShowTip(!showTip)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
              showTip ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-600'
            }`}
          >
            <Lightbulb size={12} />
            小提示
          </button>
        </div>

        {showTip && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 leading-relaxed">
            💡 {spot.tip}
          </div>
        )}
      </div>
    </div>
  );
}

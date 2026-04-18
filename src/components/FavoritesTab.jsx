import { Heart, MapPin, ExternalLink, UtensilsCrossed } from 'lucide-react';

function mapsUrl(item) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + item.address)}`;
}

export default function FavoritesTab({ itinerary, restaurants, favorites, toggleFavorite }) {
  const allSpots = itinerary.flatMap((d) =>
    d.spots.map((s) => ({ ...s, type: 'spot', dayNum: d.day }))
  );
  const allRestaurants = restaurants.map((r) => ({ ...r, type: 'restaurant' }));
  const allItems = [...allSpots, ...allRestaurants];

  const saved = allItems.filter((item) => favorites.includes(item.id));
  const savedSpots = saved.filter((i) => i.type === 'spot');
  const savedRestaurants = saved.filter((i) => i.type === 'restaurant');

  if (saved.length === 0) {
    return (
      <div className="tab-content flex flex-col items-center justify-center py-24 px-8 text-center">
        <Heart size={48} className="text-slate-200 mb-4" />
        <p className="text-slate-500 font-medium">還沒有收藏項目</p>
        <p className="text-sm text-slate-400 mt-1">在行程或美食頁面點擊愛心即可收藏</p>
      </div>
    );
  }

  return (
    <div className="tab-content p-4 space-y-5">
      <p className="text-xs text-slate-400">共收藏 {saved.length} 個項目</p>

      {savedSpots.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-slate-600 flex items-center gap-1.5 mb-2">
            <MapPin size={14} className="text-sakura-400" />
            收藏景點 ({savedSpots.length})
          </h2>
          <div className="space-y-2">
            {savedSpots.map((spot) => (
              <div key={spot.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-tokyoBlue-500 font-medium">Day {spot.dayNum}</span>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">{spot.name}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{spot.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleFavorite(spot.id)}
                    className="shrink-0 p-1.5 text-sakura-500"
                    aria-label="取消收藏"
                  >
                    <Heart size={18} fill="currentColor" />
                  </button>
                </div>
                <a
                  href={mapsUrl(spot)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs bg-tokyoBlue-500 text-white px-3 py-1.5 rounded-lg hover:bg-tokyoBlue-600 transition-colors"
                >
                  <ExternalLink size={11} />
                  Google Maps
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {savedRestaurants.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-slate-600 flex items-center gap-1.5 mb-2">
            <UtensilsCrossed size={14} className="text-orange-400" />
            收藏餐廳 ({savedRestaurants.length})
          </h2>
          <div className="space-y-2">
            {savedRestaurants.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">{r.cuisine}</span>
                      <span className="text-xs font-bold text-slate-500">{r.priceRange}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">{r.name}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{r.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleFavorite(r.id)}
                    className="shrink-0 p-1.5 text-sakura-500"
                    aria-label="取消收藏"
                  >
                    <Heart size={18} fill="currentColor" />
                  </button>
                </div>
                <a
                  href={mapsUrl(r)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs bg-tokyoBlue-500 text-white px-3 py-1.5 rounded-lg hover:bg-tokyoBlue-600 transition-colors"
                >
                  <ExternalLink size={11} />
                  Google Maps
                </a>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

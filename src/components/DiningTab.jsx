import { useState } from 'react';
import { MapPin, Heart, ExternalLink, UtensilsCrossed } from 'lucide-react';

const CUISINES = ['全部', '壽司', '拉麵', '和食', '洋食', '居酒屋', '甜點'];
const PRICES = ['全部', '¥', '¥¥', '¥¥¥'];

const PRICE_LABELS = { '¥': '平價', '¥¥': '中價位', '¥¥¥': '高級' };
const PRICE_COLORS = {
  '¥': 'text-green-600',
  '¥¥': 'text-amber-600',
  '¥¥¥': 'text-red-600',
};

function mapsUrl(r) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + r.address)}`;
}

export default function DiningTab({ restaurants, isFavorite, toggleFavorite, searchQuery }) {
  const [cuisine, setCuisine] = useState('全部');
  const [price, setPrice] = useState('全部');

  const q = searchQuery.trim().toLowerCase();

  const filtered = restaurants.filter((r) => {
    const matchQ = !q || r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q) || r.cuisine.includes(q);
    const matchC = cuisine === '全部' || r.cuisine === cuisine;
    const matchP = price === '全部' || r.priceRange === price;
    return matchQ && matchC && matchP;
  });

  return (
    <div className="tab-content">
      {/* Cuisine filter */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 space-y-2">
        <div className="flex overflow-x-auto gap-2 no-scrollbar">
          {CUISINES.map((c) => (
            <button
              key={c}
              onClick={() => setCuisine(c)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                cuisine === c
                  ? 'bg-sakura-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {PRICES.map((p) => (
            <button
              key={p}
              onClick={() => setPrice(p)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                price === p
                  ? 'bg-tokyoBlue-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p === '全部' ? '全部價位' : `${p} ${PRICE_LABELS[p]}`}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-400">{filtered.length} 間餐廳</p>
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <UtensilsCrossed size={40} className="mx-auto mb-2 opacity-30" />
            <p>找不到符合條件的餐廳</p>
          </div>
        )}
        {filtered.map((r) => (
          <RestaurantCard key={r.id} restaurant={r} isFavorite={isFavorite} toggleFavorite={toggleFavorite} />
        ))}
      </div>
    </div>
  );
}

function RestaurantCard({ restaurant: r, isFavorite, toggleFavorite }) {
  const fav = isFavorite(r.id);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
              {r.cuisine}
            </span>
            <span className={`text-xs font-bold ${PRICE_COLORS[r.priceRange]}`}>{r.priceRange}</span>
          </div>
          <h3 className="text-base font-bold text-slate-800">{r.name}</h3>
        </div>
        <button
          onClick={() => toggleFavorite(r.id)}
          className={`shrink-0 p-1.5 rounded-full transition-colors ${fav ? 'text-sakura-500' : 'text-slate-300 hover:text-sakura-400'}`}
          aria-label={fav ? '取消收藏' : '加入收藏'}
        >
          <Heart size={18} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>

      <p className="text-sm text-slate-500 leading-relaxed mb-3">{r.desc}</p>

      {r.mustTry.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-slate-400 mb-1.5">必點</p>
          <div className="flex flex-wrap gap-1.5">
            {r.mustTry.map((item) => (
              <span key={item} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs text-slate-400 min-w-0 mr-2">
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">{r.address}</span>
        </span>
        <a
          href={mapsUrl(r)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 text-xs bg-tokyoBlue-500 text-white px-3 py-1.5 rounded-lg hover:bg-tokyoBlue-600 transition-colors"
        >
          <ExternalLink size={11} />
          Maps
        </a>
      </div>
    </div>
  );
}

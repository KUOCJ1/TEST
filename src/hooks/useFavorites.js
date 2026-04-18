import { useState } from 'react';

export function useFavorites(storageKey = 'tokyo-favorites') {
  const [favorites, setFavorites] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const isFavorite = (id) => favorites.includes(id);

  return [favorites, toggleFavorite, isFavorite];
}

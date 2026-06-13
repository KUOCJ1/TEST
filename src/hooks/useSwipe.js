import { useRef, useCallback } from 'react';

export function useSwipe({ onSwipeLeft, onSwipeRight, minDistance = 48 }) {
  const startX = useRef(null);
  const startY = useRef(null);

  const onTouchStart = useCallback((e) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    const dy = e.changedTouches[0].clientY - startY.current;
    startX.current = null;
    startY.current = null;
    // Ignore mostly-vertical swipes (scrolling)
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (dx > minDistance) onSwipeRight?.();
    else if (dx < -minDistance) onSwipeLeft?.();
  }, [onSwipeLeft, onSwipeRight, minDistance]);

  return { onTouchStart, onTouchEnd };
}

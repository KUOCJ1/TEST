import { useState, useEffect, useRef } from 'react';

export function useCurrentMinute() {
  const [minute, setMinute] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  const intervalRef = useRef(null);

  useEffect(() => {
    function tick() {
      const now = new Date();
      setMinute(now.getHours() * 60 + now.getMinutes());
    }

    // Align first tick to the next minute boundary, then run every 60 s
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    const timeout = setTimeout(() => {
      tick();
      intervalRef.current = setInterval(tick, 60_000);
    }, msToNextMinute);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return minute;
}

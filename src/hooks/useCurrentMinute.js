import { useState, useEffect } from 'react';

export function useCurrentMinute() {
  const [minute, setMinute] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setMinute(now.getHours() * 60 + now.getMinutes());
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return minute;
}

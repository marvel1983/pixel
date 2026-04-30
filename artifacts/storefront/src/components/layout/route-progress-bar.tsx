import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

export function RouteProgressBar() {
  const [location] = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevLocation = useRef(location);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (location === prevLocation.current) return;
    prevLocation.current = location;

    timers.current.forEach(clearTimeout);
    setVisible(true);
    setProgress(0);

    const t1 = setTimeout(() => setProgress(80), 10);
    const t2 = setTimeout(() => setProgress(100), 300);
    const t3 = setTimeout(() => setVisible(false), 600);
    const t4 = setTimeout(() => setProgress(0), 700);
    timers.current = [t1, t2, t3, t4];

    return () => timers.current.forEach(clearTimeout);
  }, [location]);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 z-[9999] h-[3px] bg-primary pointer-events-none transition-[width,opacity] duration-300 ease-out"
      style={{ width: `${progress}%`, opacity: visible ? 1 : 0 }}
    />
  );
}

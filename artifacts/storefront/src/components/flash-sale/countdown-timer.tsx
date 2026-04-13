import { useState, useEffect } from "react";

interface CountdownTimerProps {
  endsAt: string;
  onExpired?: () => void;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function getTimeLeft(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { hours, minutes, seconds };
}

export function CountdownTimer({ endsAt, onExpired, size = "md", className = "" }: CountdownTimerProps) {
  const [time, setTime] = useState(getTimeLeft(endsAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const left = getTimeLeft(endsAt);
      setTime(left);
      if (!left) { clearInterval(interval); onExpired?.(); }
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt, onExpired]);

  if (!time) {
    return <span className={`text-muted-foreground ${className}`}>Expired</span>;
  }

  // xs: compact inline text, no boxes
  if (size === "xs") {
    return (
      <span className={`font-mono font-bold tabular-nums ${className}`}>
        {pad(time.hours)}:{pad(time.minutes)}:{pad(time.seconds)}
      </span>
    );
  }

  const sizeClasses = {
    sm: "text-xs gap-1",
    md: "text-sm gap-1.5",
    lg: "text-lg gap-2 font-bold",
  };

  const boxClasses = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-12 h-12 text-lg",
  };

  return (
    <div className={`flex items-center ${sizeClasses[size]} ${className}`}>
      <TimeBox value={pad(time.hours)} label="HRS" className={boxClasses[size]} />
      <span className="font-bold">:</span>
      <TimeBox value={pad(time.minutes)} label="MIN" className={boxClasses[size]} />
      <span className="font-bold">:</span>
      <TimeBox value={pad(time.seconds)} label="SEC" className={boxClasses[size]} />
    </div>
  );
}

function TimeBox({ value, label, className }: { value: string; label: string; className: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`${className} flex items-center justify-center rounded bg-black/10 font-mono font-bold`}>
        {value}
      </div>
      <span className="text-[10px] uppercase opacity-60 mt-0.5">{label}</span>
    </div>
  );
}

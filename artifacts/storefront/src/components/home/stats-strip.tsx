import { cn } from "@/lib/utils";

const STATS = [
  { value: "50,000+", label: "Happy customers", accent: "#3b82f6" },
  { value: "4.8★", label: "Average rating", accent: "#f59e0b" },
  { value: "< 5 min", label: "Key delivery", accent: "#22c55e" },
  { value: "10+ yrs", label: "Trusted seller", accent: "#a855f7" },
];

export function StatsStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl",
        className,
      )}
      style={{
        background: "linear-gradient(135deg, #0a1628 0%, #0d2346 50%, #0a1628 100%)",
      }}
    >
      {/* subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.8) 1px,transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative grid grid-cols-2 divide-x divide-white/10 sm:grid-cols-4">
        {STATS.map(({ value, label, accent }, i) => (
          <div
            key={label}
            className="group flex flex-col items-center justify-center gap-1 px-4 py-4 text-center transition-colors hover:bg-white/5"
          >
            {/* accent dot */}
            <div
              className="mb-1 h-1 w-6 rounded-full opacity-80"
              style={{ background: accent }}
            />
            <span
              className="text-xl font-extrabold leading-none tracking-tight sm:text-2xl"
              style={{ color: accent }}
            >
              {value}
            </span>
            <span className="text-[11px] font-medium text-white/55 uppercase tracking-wider">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

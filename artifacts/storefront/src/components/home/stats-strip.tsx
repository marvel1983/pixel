import { cn } from "@/lib/utils";

const STATS = [
  { value: "50,000+", label: "Happy customers" },
  { value: "4.8★", label: "Average rating" },
  { value: "< 5 min", label: "Key delivery" },
  { value: "10+ yrs", label: "Trusted seller" },
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
        {STATS.map(({ value, label }) => (
          <div
            key={label}
            className="group flex flex-col items-center justify-center gap-1 px-4 py-4 text-center transition-colors hover:bg-white/5"
          >
            {/* amber accent dot — consistent across all stats */}
            <div className="mb-1 h-1 w-6 rounded-full bg-amber-400 opacity-80" />
            <span className="text-xl font-extrabold leading-none tracking-tight text-white sm:text-2xl">
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

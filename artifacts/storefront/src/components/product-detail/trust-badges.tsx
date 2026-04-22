import { ShieldCheck, Zap, RefreshCw, Headphones } from "lucide-react";

const BADGES = [
  {
    icon: ShieldCheck,
    label: "Secure Payment",
    sub: "256-bit SSL encrypted",
    accent: "#22c55e",
    bg: "#22c55e14",
    border: "#22c55e33",
  },
  {
    icon: Zap,
    label: "Instant Delivery",
    sub: "Digital key via email",
    accent: "#3b82f6",
    bg: "#3b82f614",
    border: "#3b82f633",
  },
  {
    icon: RefreshCw,
    label: "Money-Back",
    sub: "30-day guarantee",
    accent: "#f59e0b",
    bg: "#f59e0b14",
    border: "#f59e0b33",
  },
  {
    icon: Headphones,
    label: "24/7 Support",
    sub: "Live chat & email",
    accent: "#a855f7",
    bg: "#a855f714",
    border: "#a855f733",
  },
];

export function TrustBadges() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {BADGES.map((b) => (
        <div
          key={b.label}
          className="flex items-center gap-3.5 rounded-xl border p-4 bg-card transition-shadow hover:shadow-sm"
          style={{ borderColor: b.border }}
        >
          {/* Icon circle */}
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: b.bg, border: `1.5px solid ${b.border}` }}
          >
            <b.icon className="h-5 w-5" style={{ color: b.accent }} strokeWidth={1.8} />
          </div>

          {/* Text */}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">{b.label}</p>
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{b.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

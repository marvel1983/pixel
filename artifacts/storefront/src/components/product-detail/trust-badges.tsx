import { useState, useEffect } from "react";
import { INFO_ICON_MAP, ACCENT_BY_ICON } from "@/lib/info-tile-icons";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

const DEFAULT_TILES = [
  { icon: "shield", label: "Secure Payment", sub: "256-bit SSL encrypted" },
  { icon: "zap", label: "Instant Delivery", sub: "Digital key via email" },
  { icon: "refresh", label: "Money-Back", sub: "30-day guarantee" },
  { icon: "headphones", label: "24/7 Support", sub: "Live chat & email" },
];

type Tile = { icon: string; label: string; sub: string };

export function TrustBadges() {
  const [tiles, setTiles] = useState<Tile[]>(DEFAULT_TILES);

  useEffect(() => {
    fetch(`${API_URL}/guarantee-tiles`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.tiles) && d.tiles.length > 0) setTiles(d.tiles); })
      .catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((b) => {
        const Icon = INFO_ICON_MAP[b.icon];
        const colors = ACCENT_BY_ICON[b.icon] ?? { accent: "#3b82f6", bg: "#3b82f614", border: "#3b82f633" };
        return (
          <div
            key={b.label}
            className="flex items-center gap-3.5 rounded-xl border p-4 bg-card transition-shadow hover:shadow-sm"
            style={{ borderColor: colors.border }}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ background: colors.bg, border: `1.5px solid ${colors.border}` }}
            >
              {Icon && <Icon className="h-5 w-5" style={{ color: colors.accent }} strokeWidth={1.8} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">{b.label}</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{b.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Zap, X } from "lucide-react";
import { CountdownTimer } from "./countdown-timer";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface BannerData {
  id: number;
  name: string;
  slug: string;
  bannerText: string;
  bannerColor: string;
  endsAt: string;
}

export function FlashSaleBanner() {
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    fetch(`${API}/flash-sales/banner`)
      .then((r) => r.json())
      .then((d) => { if (d.banner) setBanner(d.banner); })
      .catch(() => {});
  }, []);

  if (!banner || dismissed || expired) return null;

  return (
    <div
      className="sticky top-0 z-50 relative flex items-center justify-center gap-3 px-4 py-2 text-white text-sm"
      style={{ backgroundColor: banner.bannerColor || "#ef4444" }}
    >
      <Link href="/flash-sale" className="flex items-center gap-2 hover:opacity-90">
        <Zap className="h-4 w-4 fill-current" />
        <span className="font-semibold">{banner.bannerText || `${banner.name} — Don't miss out!`}</span>
      </Link>
      <CountdownTimer endsAt={banner.endsAt} onExpired={() => setExpired(true)} size="sm" />
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/20"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

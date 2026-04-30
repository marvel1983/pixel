import { Monitor, Apple, Terminal, Gamepad2, Package, Music, Tv, CreditCard } from "lucide-react";

export interface PlatformMeta {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

export const PLATFORM_META: Record<string, PlatformMeta> = {
  WINDOWS:    { label: "Windows",     icon: <Monitor className="h-5 w-5" />,    color: "#60a5fa", bg: "#0d1f3c" },
  MAC:        { label: "macOS",       icon: <Apple className="h-5 w-5" />,      color: "#a78bfa", bg: "#1a0d3c" },
  LINUX:      { label: "Linux",       icon: <Terminal className="h-5 w-5" />,   color: "#f59e0b", bg: "#2a1a00" },
  STEAM:      { label: "Steam",       icon: <Gamepad2 className="h-5 w-5" />,   color: "#4fc3f7", bg: "#001a2a" },
  EPIC:       { label: "Epic Games",  icon: <Gamepad2 className="h-5 w-5" />,   color: "#e2e8f0", bg: "#1a1a1a" },
  GOG:        { label: "GOG",         icon: <Gamepad2 className="h-5 w-5" />,   color: "#c084fc", bg: "#1a0028" },
  ORIGIN:     { label: "EA App",      icon: <Gamepad2 className="h-5 w-5" />,   color: "#fb923c", bg: "#2a1000" },
  UPLAY:      { label: "Ubisoft",     icon: <Gamepad2 className="h-5 w-5" />,   color: "#60a5fa", bg: "#001028" },
  XBOX:       { label: "Xbox",        icon: <Gamepad2 className="h-5 w-5" />,   color: "#4ade80", bg: "#001a0a" },
  PLAYSTATION: { label: "PlayStation", icon: <Gamepad2 className="h-5 w-5" />,  color: "#60a5fa", bg: "#001028" },
  NINTENDO:   { label: "Nintendo",    icon: <Gamepad2 className="h-5 w-5" />,   color: "#f87171", bg: "#2a0000" },
  SPOTIFY:    { label: "Spotify",     icon: <Music className="h-5 w-5" />,      color: "#1db954", bg: "#001a06" },
  NETFLIX:    { label: "Netflix",     icon: <Tv className="h-5 w-5" />,         color: "#e50914", bg: "#1f0003" },
  HULU:       { label: "Hulu",        icon: <Tv className="h-5 w-5" />,         color: "#3dba7d", bg: "#001a0a" },
  DISNEY:     { label: "Disney+",     icon: <Tv className="h-5 w-5" />,         color: "#0063e5", bg: "#000f2a" },
  PARAMOUNT:  { label: "Paramount+",  icon: <Tv className="h-5 w-5" />,         color: "#0064ff", bg: "#00101f" },
  AMAZON:     { label: "Amazon",      icon: <CreditCard className="h-5 w-5" />, color: "#ff9900", bg: "#1f1200" },
  PAYSAFE:    { label: "Paysafecard", icon: <CreditCard className="h-5 w-5" />, color: "#6eb5ff", bg: "#000d1f" },
  ROBLOX:     { label: "Roblox",      icon: <Gamepad2 className="h-5 w-5" />,   color: "#e53935", bg: "#1f0000" },
  MINECRAFT:  { label: "Minecraft",   icon: <Gamepad2 className="h-5 w-5" />,   color: "#62b347", bg: "#061a00" },
  BATTLE_NET: { label: "Battle.net",  icon: <Gamepad2 className="h-5 w-5" />,   color: "#00aff0", bg: "#001a28" },
  ROCKSTAR:   { label: "Rockstar",    icon: <Gamepad2 className="h-5 w-5" />,   color: "#fcaf17", bg: "#1a1200" },
  PUBG:       { label: "PUBG",        icon: <Gamepad2 className="h-5 w-5" />,   color: "#f0a500", bg: "#1a1000" },
  RAZER:      { label: "Razer Gold",  icon: <Gamepad2 className="h-5 w-5" />,   color: "#44d62c", bg: "#001a00" },
  OTHER:      { label: "Other",       icon: <Package className="h-5 w-5" />,    color: "#94a3b8", bg: "#1a1d24" },
};

export function getPlatformMeta(key: string): PlatformMeta {
  return PLATFORM_META[key] ?? { label: key, icon: <Package className="h-5 w-5" />, color: "#94a3b8", bg: "#1a1d24" };
}

export const ALL_PLATFORMS = Object.keys(PLATFORM_META);

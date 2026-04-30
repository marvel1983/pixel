import { Globe, Monitor, Key, Shield, Headphones, Zap, RefreshCw, Package, Truck, Star, Lock, CheckCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const INFO_ICON_MAP: Record<string, LucideIcon> = {
  globe: Globe,
  monitor: Monitor,
  key: Key,
  shield: Shield,
  headphones: Headphones,
  zap: Zap,
  refresh: RefreshCw,
  package: Package,
  truck: Truck,
  star: Star,
  lock: Lock,
  check: CheckCircle,
};

export const INFO_ICON_OPTIONS = [
  { value: "globe", label: "Globe" },
  { value: "monitor", label: "Monitor" },
  { value: "key", label: "Key" },
  { value: "shield", label: "Shield" },
  { value: "headphones", label: "Headphones" },
  { value: "zap", label: "Lightning" },
  { value: "refresh", label: "Refresh / Money-Back" },
  { value: "package", label: "Package" },
  { value: "truck", label: "Truck" },
  { value: "star", label: "Star" },
  { value: "lock", label: "Lock" },
  { value: "check", label: "Check Circle" },
];

export const ACCENT_BY_ICON: Record<string, { accent: string; bg: string; border: string }> = {
  shield: { accent: "#22c55e", bg: "#22c55e14", border: "#22c55e33" },
  zap:    { accent: "#3b82f6", bg: "#3b82f614", border: "#3b82f633" },
  refresh:{ accent: "#f59e0b", bg: "#f59e0b14", border: "#f59e0b33" },
  headphones: { accent: "#a855f7", bg: "#a855f714", border: "#a855f733" },
  globe:  { accent: "#06b6d4", bg: "#06b6d414", border: "#06b6d433" },
  monitor:{ accent: "#3b82f6", bg: "#3b82f614", border: "#3b82f633" },
  key:    { accent: "#f59e0b", bg: "#f59e0b14", border: "#f59e0b33" },
  truck:  { accent: "#10b981", bg: "#10b98114", border: "#10b98133" },
  star:   { accent: "#f59e0b", bg: "#f59e0b14", border: "#f59e0b33" },
  lock:   { accent: "#22c55e", bg: "#22c55e14", border: "#22c55e33" },
  check:  { accent: "#22c55e", bg: "#22c55e14", border: "#22c55e33" },
  package:{ accent: "#a855f7", bg: "#a855f714", border: "#a855f733" },
};

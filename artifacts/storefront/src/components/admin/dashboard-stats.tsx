import { useEffect, useState } from "react";
import {
  ShoppingCart, DollarSign, Package, Clock,
  Wallet, TrendingUp, CalendarDays, HelpCircle, Headphones,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface DashboardStats {
  todayOrders: number; todayRevenue: number;
  monthOrders: number; monthRevenue: number;
  activeProducts: number; pendingOrders: number;
  pendingQA: number; openTickets: number;
  metenziBalance: number | null;
}

function usd(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

interface StatDef {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  sub?: string;
}

function StatCard({ label, value, icon, accent, sub }: StatDef) {
  return (
    <div
      className="flex items-center gap-3 rounded-md px-3 py-2.5"
      style={{ background: "#1a1d28", border: "1px solid #252836" }}
    >
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
        style={{ background: `${accent}18` }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium truncate" style={{ color: "#4a5568" }}>{label}</p>
        <p className="text-sm font-bold leading-tight" style={{ color: "#e2e8f0" }}>{value}</p>
        {sub && <p className="text-[10px]" style={{ color: "#3a4255" }}>{sub}</p>}
      </div>
      <div className="h-full w-0.5 rounded-full shrink-0 self-stretch" style={{ background: `${accent}40` }} />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="flex items-center gap-3 rounded-md px-3 py-2.5 animate-pulse"
      style={{ background: "#1a1d28", border: "1px solid #252836" }}
    >
      <div className="h-7 w-7 rounded shrink-0" style={{ background: "#252836" }} />
      <div className="flex-1 space-y-1.5">
        <div className="h-2 rounded w-16" style={{ background: "#252836" }} />
        <div className="h-3.5 rounded w-12" style={{ background: "#2a2d3a" }} />
      </div>
    </div>
  );
}

export function DashboardStatsSection() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    fetch(`${API_URL}/admin/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: DashboardStats) => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!stats) return null;

  const cards: StatDef[] = [
    { label: "Orders Today",       value: String(stats.todayOrders),   icon: <ShoppingCart className="h-3.5 w-3.5" style={{ color: "#3b82f6" }} />, accent: "#3b82f6" },
    { label: "Revenue Today",      value: usd(stats.todayRevenue),     icon: <DollarSign    className="h-3.5 w-3.5" style={{ color: "#22c55e" }} />, accent: "#22c55e" },
    { label: "Orders This Month",  value: String(stats.monthOrders),   icon: <CalendarDays  className="h-3.5 w-3.5" style={{ color: "#a855f7" }} />, accent: "#a855f7" },
    { label: "Revenue This Month", value: usd(stats.monthRevenue),     icon: <TrendingUp    className="h-3.5 w-3.5" style={{ color: "#6366f1" }} />, accent: "#6366f1" },
    { label: "Active Products",    value: String(stats.activeProducts),icon: <Package       className="h-3.5 w-3.5" style={{ color: "#f59e0b" }} />, accent: "#f59e0b" },
    { label: "Pending Orders",     value: String(stats.pendingOrders), icon: <Clock         className="h-3.5 w-3.5" style={{ color: "#eab308" }} />, accent: "#eab308" },
    { label: "Pending Q&A",        value: String(stats.pendingQA),     icon: <HelpCircle    className="h-3.5 w-3.5" style={{ color: "#ec4899" }} />, accent: "#ec4899" },
    { label: "Open Tickets",       value: String(stats.openTickets),   icon: <Headphones    className="h-3.5 w-3.5" style={{ color: "#06b6d4" }} />, accent: "#06b6d4" },
    { label: "Metenzi Balance",    value: stats.metenziBalance !== null ? usd(stats.metenziBalance) : "N/A", icon: <Wallet className="h-3.5 w-3.5" style={{ color: "#14b8a6" }} />, accent: "#14b8a6" },
  ];

  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => <StatCard key={c.label} {...c} />)}
    </div>
  );
}

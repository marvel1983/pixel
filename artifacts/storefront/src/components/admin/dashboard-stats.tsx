import { useEffect, useState } from "react";
import {
  ShoppingCart,
  DollarSign,
  Package,
  Clock,
  Wallet,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  monthOrders: number;
  monthRevenue: number;
  activeProducts: number;
  pendingOrders: number;
  metenziBalance: number | null;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function DashboardStatsSection() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    fetch(`${API_URL}/admin/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: DashboardStats) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards: StatCardProps[] = [
    {
      label: "Orders Today",
      value: String(stats.todayOrders),
      icon: <ShoppingCart className="h-5 w-5 text-blue-600" />,
      color: "bg-blue-50",
    },
    {
      label: "Revenue Today",
      value: formatUsd(stats.todayRevenue),
      icon: <DollarSign className="h-5 w-5 text-green-600" />,
      color: "bg-green-50",
    },
    {
      label: "Orders This Month",
      value: String(stats.monthOrders),
      icon: <CalendarDays className="h-5 w-5 text-purple-600" />,
      color: "bg-purple-50",
    },
    {
      label: "Revenue This Month",
      value: formatUsd(stats.monthRevenue),
      icon: <TrendingUp className="h-5 w-5 text-indigo-600" />,
      color: "bg-indigo-50",
    },
    {
      label: "Active Products",
      value: String(stats.activeProducts),
      icon: <Package className="h-5 w-5 text-orange-600" />,
      color: "bg-orange-50",
    },
    {
      label: "Pending Orders",
      value: String(stats.pendingOrders),
      icon: <Clock className="h-5 w-5 text-yellow-600" />,
      color: "bg-yellow-50",
    },
    {
      label: "Metenzi Balance",
      value: stats.metenziBalance !== null ? formatUsd(stats.metenziBalance) : "N/A",
      icon: <Wallet className="h-5 w-5 text-teal-600" />,
      color: "bg-teal-50",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}

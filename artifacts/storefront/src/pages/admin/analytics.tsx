import { useEffect, useState, useCallback } from "react";
import {
  ShoppingCart,
  DollarSign,
  TrendingUp,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { RevenueChart, OrdersChart } from "@/components/admin/analytics-charts";
import { TopProductsTable, CategoryRevenueChart } from "@/components/admin/analytics-tables";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface AnalyticsData {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    newCustomers: number;
    returningCustomers: number;
  };
  dailyRevenue: { date: string; revenue: number }[];
  ordersByStatus: { date: string; [status: string]: string | number }[];
  topProducts: { productName: string; unitsSold: number; revenue: number }[];
  categoryRevenue: { category: string; revenue: number }[];
}

type Preset = "today" | "7d" | "30d" | "month" | "custom";

function getDateRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  let fromDate: Date;
  switch (preset) {
    case "today":
      fromDate = now;
      break;
    case "7d":
      fromDate = new Date(Date.now() - 7 * 86400000);
      break;
    case "month":
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "30d":
    default:
      fromDate = new Date(Date.now() - 30 * 86400000);
      break;
  }
  return { from: fromDate.toISOString().split("T")[0], to };
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(value);
}

const presets: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom" },
];

export default function AnalyticsPage() {
  const [activePreset, setActivePreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((s) => s.token);

  const fetchData = useCallback(
    (from: string, to: string) => {
      setLoading(true);
      fetch(`${API_URL}/admin/analytics?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d: AnalyticsData) => setData(d))
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [token],
  );

  useEffect(() => {
    const { from, to } = getDateRange("30d");
    fetchData(from, to);
  }, [fetchData]);

  const handlePreset = (preset: Preset) => {
    setActivePreset(preset);
    if (preset !== "custom") {
      const { from, to } = getDateRange(preset);
      fetchData(from, to);
    }
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      fetchData(customFrom, customTo);
    }
  };

  const s = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Track your store performance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={activePreset === p.key ? "default" : "outline"}
              onClick={() => handlePreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {activePreset === "custom" && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-md border px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-md border px-3 py-1.5 text-sm"
            />
          </div>
          <Button size="sm" onClick={handleCustomApply} disabled={!customFrom || !customTo}>
            Apply
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[360px] rounded-lg" />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Total Revenue", value: formatUsd(s!.totalRevenue), icon: <DollarSign className="h-5 w-5 text-green-600" />, bg: "bg-green-50" },
              { label: "Total Orders", value: String(s!.totalOrders), icon: <ShoppingCart className="h-5 w-5 text-blue-600" />, bg: "bg-blue-50" },
              { label: "Avg Order Value", value: formatUsd(s!.avgOrderValue), icon: <TrendingUp className="h-5 w-5 text-purple-600" />, bg: "bg-purple-50" },
              { label: "New Customers", value: String(s!.newCustomers), icon: <UserPlus className="h-5 w-5 text-indigo-600" />, bg: "bg-indigo-50" },
              { label: "Returning", value: String(s!.returningCustomers), icon: <UserCheck className="h-5 w-5 text-teal-600" />, bg: "bg-teal-50" },
            ].map((card) => (
              <div key={card.label} className="rounded-lg border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-2xl font-bold">{card.value}</p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${card.bg}`}>
                    {card.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <RevenueChart data={data.dailyRevenue} />
            <OrdersChart data={data.ordersByStatus} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TopProductsTable data={data.topProducts} />
            <CategoryRevenueChart data={data.categoryRevenue} />
          </div>
        </>
      ) : (
        <div className="rounded-lg border bg-white p-12 text-center text-muted-foreground">
          Failed to load analytics data.
        </div>
      )}
    </div>
  );
}

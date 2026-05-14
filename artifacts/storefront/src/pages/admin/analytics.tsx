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
import { RevenueChart } from "@/components/admin/analytics-charts";
import { ProductsSoldTable, TopCustomersTable } from "@/components/admin/analytics-tables";
import { DATE_PRESETS, presetToRange, type DatePresetKey } from "@/lib/date-presets";

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
  products: { productName: string; unitsSold: number; revenue: number; avgPrice: number }[];
  topCustomers: { email: string; name: string | null; orderCount: number; revenue: number }[];
}

function formatEur(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(value);
}

export default function AnalyticsPage() {
  const initialRange = presetToRange("30days")!;
  const [activePreset, setActivePreset] = useState<DatePresetKey>("30days");
  const [customFrom, setCustomFrom] = useState(initialRange.from);
  const [customTo, setCustomTo] = useState(initialRange.to);
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
    fetchData(initialRange.from, initialRange.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

  const handlePreset = (key: DatePresetKey) => {
    setActivePreset(key);
    if (key === "custom") return;
    const range = presetToRange(key);
    if (range) {
      setCustomFrom(range.from);
      setCustomTo(range.to);
      fetchData(range.from, range.to);
    }
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      setActivePreset("custom");
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
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-white p-2">
        <span className="px-1 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
          Period:
        </span>
        {DATE_PRESETS.map((p) => (
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

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => { setCustomFrom(e.target.value); setActivePreset("custom"); }}
            className="rounded-md border px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
          <input
            type="date"
            value={customTo}
            onChange={(e) => { setCustomTo(e.target.value); setActivePreset("custom"); }}
            className="rounded-md border px-3 py-1.5 text-sm"
          />
        </div>
        <Button size="sm" onClick={handleCustomApply} disabled={!customFrom || !customTo}>
          Apply
        </Button>
      </div>

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
              { label: "Total Revenue", value: formatEur(s!.totalRevenue), icon: <DollarSign className="h-5 w-5 text-green-600" />, bg: "bg-green-50" },
              { label: "Total Orders", value: String(s!.totalOrders), icon: <ShoppingCart className="h-5 w-5 text-blue-600" />, bg: "bg-blue-50" },
              { label: "Avg Order Value", value: formatEur(s!.avgOrderValue), icon: <TrendingUp className="h-5 w-5 text-purple-600" />, bg: "bg-purple-50" },
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

          <RevenueChart data={data.dailyRevenue} />

          <div className="grid gap-6 lg:grid-cols-2">
            <ProductsSoldTable data={data.products} />
            <TopCustomersTable data={data.topCustomers} />
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

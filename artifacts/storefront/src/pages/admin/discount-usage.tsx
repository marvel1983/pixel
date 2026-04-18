import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, BarChart3, DollarSign, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface UsageOrder {
  id: number; orderNumber: string; email: string;
  totalUsd: string; discountUsd: string; createdAt: string;
}

interface DailyUsage { day: string; cnt: number; total: string }

interface DiscountInfo {
  code: string; discountType: string; discountValue: string;
  usedCount: number; usageLimit: number | null;
}

interface UsageStats { totalOrders: number; totalDiscounted: number; totalRevenue: number }

export default function DiscountUsagePage() {
  const params = useParams<{ id: string }>();
  const [discount, setDiscount] = useState<DiscountInfo | null>(null);
  const [orders, setOrders] = useState<UsageOrder[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [stats, setStats] = useState<UsageStats>({ totalOrders: 0, totalDiscounted: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/admin/discounts/${params.id}/usage`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        setDiscount(d.discount);
        setOrders(d.orders);
        setDailyUsage(d.dailyUsage);
        setStats(d.stats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id, token]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;

  const maxCount = Math.max(...dailyUsage.map((d) => d.cnt), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/discounts")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">Usage Report: <span className="font-mono">{discount?.code}</span></h1>
        <Badge variant="outline">{discount?.discountType === "PERCENTAGE" ? `${discount?.discountValue}%` : `€${discount?.discountValue}`}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-white p-4 flex items-center gap-3">
          <ShoppingCart className="h-5 w-5 text-blue-500" />
          <div><p className="text-2xl font-bold">{stats.totalOrders}</p><p className="text-xs text-muted-foreground">Orders Used</p></div>
        </div>
        <div className="rounded-lg border bg-white p-4 flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-green-500" />
          <div><p className="text-2xl font-bold">€{stats.totalDiscounted.toFixed(2)}</p><p className="text-xs text-muted-foreground">Total Discounted</p></div>
        </div>
        <div className="rounded-lg border bg-white p-4 flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-purple-500" />
          <div><p className="text-2xl font-bold">€{stats.totalRevenue.toFixed(2)}</p><p className="text-xs text-muted-foreground">Revenue from Code</p></div>
        </div>
      </div>

      {dailyUsage.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="font-semibold text-sm mb-3">Daily Usage</h3>
          <div className="flex items-end gap-1 h-32">
            {dailyUsage.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">{d.cnt}</span>
                <div className="w-full bg-blue-500 rounded-t" style={{ height: `${(d.cnt / maxCount) * 100}%`, minHeight: 4 }} />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="px-3 py-3 font-medium text-muted-foreground">Order #</th>
              <th className="px-3 py-3 font-medium text-muted-foreground">Customer</th>
              <th className="px-3 py-3 font-medium text-muted-foreground">Order Total</th>
              <th className="px-3 py-3 font-medium text-muted-foreground">Discount</th>
              <th className="px-3 py-3 font-medium text-muted-foreground">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-3 py-3 font-mono text-xs text-blue-600 cursor-pointer" onClick={() => navigate(`/admin/orders/${o.id}`)}>{o.orderNumber}</td>
                <td className="px-3 py-3 text-xs">{o.email}</td>
                <td className="px-3 py-3 text-xs">€{o.totalUsd}</td>
                <td className="px-3 py-3 text-xs text-green-600">-${o.discountUsd}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className="px-3 py-12 text-center text-muted-foreground">No orders have used this code yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

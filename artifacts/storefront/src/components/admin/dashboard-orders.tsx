import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface RecentOrder {
  id: number;
  orderNumber: string;
  customerName: string;
  totalUsd: number;
  status: string;
  createdAt: string;
  products: string[];
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  REFUNDED: "bg-gray-100 text-gray-800",
  FAILED: "bg-red-100 text-red-800",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecentOrdersSection() {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((s) => s.token);
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetch(`${API_URL}/admin/dashboard/recent-orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { orders: RecentOrder[] }) => setOrders(data.orders))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">Recent Orders</h2>
      </div>
      {orders.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground">
          No orders yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-6 py-3 font-medium text-muted-foreground">Order #</th>
                <th className="px-6 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="px-6 py-3 font-medium text-muted-foreground">Products</th>
                <th className="px-6 py-3 font-medium text-muted-foreground">Total</th>
                <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-3 font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setLocation(`/admin/orders/${order.id}`)}
                >
                  <td className="px-6 py-3 font-medium text-blue-600">
                    {order.orderNumber}
                  </td>
                  <td className="px-6 py-3 max-w-[160px] truncate">
                    {order.customerName}
                  </td>
                  <td className="px-6 py-3 max-w-[200px] truncate text-muted-foreground">
                    {order.products.join(", ") || "—"}
                  </td>
                  <td className="px-6 py-3 font-medium">
                    ${order.totalUsd.toFixed(2)}
                  </td>
                  <td className="px-6 py-3">
                    <Badge
                      variant="secondary"
                      className={statusColors[order.status] ?? "bg-gray-100 text-gray-800"}
                    >
                      {order.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(order.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

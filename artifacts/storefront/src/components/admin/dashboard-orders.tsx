import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface RecentOrder {
  id: number; orderNumber: string; customerName: string;
  totalUsd: number; status: string; createdAt: string; products: string[];
}

const STATUS: Record<string, { bg: string; color: string; dot: string }> = {
  PENDING:    { bg: "#2a2010", color: "#eab308", dot: "#eab308" },
  PROCESSING: { bg: "#0f1e38", color: "#60a5fa", dot: "#3b82f6" },
  COMPLETED:  { bg: "#0a2015", color: "#4ade80", dot: "#22c55e" },
  CANCELLED:  { bg: "#2a0f0f", color: "#f87171", dot: "#ef4444" },
  REFUNDED:   { bg: "#1a1d28", color: "#6b7280", dot: "#4b5563" },
  FAILED:     { bg: "#2a0f0f", color: "#f87171", dot: "#ef4444" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function RecentOrdersSection() {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((s) => s.token);
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetch(`${API_URL}/admin/dashboard/recent-orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: { orders: RecentOrder[] }) => setOrders(d.orders))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="rounded-md overflow-hidden" style={{ background: "#1a1d28", border: "1px solid #252836" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid #252836" }}>
        <span className="text-xs font-semibold" style={{ color: "#c8d0e0" }}>Recent Orders</span>
        <button
          className="text-[10px] transition-colors"
          style={{ color: "#4a5568" }}
          onClick={() => setLocation("/admin/orders")}
          onMouseEnter={(e) => e.currentTarget.style.color = "#60a5fa"}
          onMouseLeave={(e) => e.currentTarget.style.color = "#4a5568"}
        >
          View all →
        </button>
      </div>

      {loading ? (
        <div className="p-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-7 rounded animate-pulse" style={{ background: "#252836" }} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-8 text-center text-[11px]" style={{ color: "#3a4255" }}>No orders yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid #1f2330" }}>
                {["Order #", "Customer", "Products", "Total", "Status", "Date"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "#3a4255" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => {
                const s = STATUS[o.status] ?? STATUS.REFUNDED;
                return (
                  <tr
                    key={o.id}
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: i < orders.length - 1 ? "1px solid #1f2330" : "none" }}
                    onClick={() => setLocation(`/admin/orders/${o.id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1e2132")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="px-3 py-2 text-[11px] font-medium" style={{ color: "#60a5fa" }}>
                      {o.orderNumber}
                    </td>
                    <td className="px-3 py-2 text-[11px] max-w-[120px] truncate" style={{ color: "#c8d0e0" }}>
                      {o.customerName}
                    </td>
                    <td className="px-3 py-2 text-[11px] max-w-[180px] truncate" style={{ color: "#4a5568" }}>
                      {o.products.join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] font-medium tabular-nums" style={{ color: "#e2e8f0" }}>
                      ${o.totalUsd.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ background: s.bg, color: s.color }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
                        {o.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[10px] whitespace-nowrap" style={{ color: "#3a4255" }}>
                      {fmtDate(o.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

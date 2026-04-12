import { useEffect, useState } from "react";
import { AlertTriangle, Star, Check, X } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface LowStockItem {
  variantId: number; productName: string; variantName: string;
  sku: string; stockCount: number; lowStockThreshold: number;
}

interface PendingReview {
  id: number; productName: string; userName: string;
  rating: number; title: string | null; body: string | null; createdAt: string;
}

function Panel({ title, icon, count, accentColor, children }: {
  title: string; icon: React.ReactNode; count: number;
  accentColor: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-md overflow-hidden" style={{ background: "#1a1d28", border: "1px solid #252836" }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid #252836" }}>
        {icon}
        <span className="text-xs font-semibold flex-1" style={{ color: "#c8d0e0" }}>{title}</span>
        {count > 0 && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-bold"
            style={{ background: `${accentColor}20`, color: accentColor }}
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function LowStockSection() {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    fetch(`${API_URL}/admin/dashboard/low-stock`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: { items: LowStockItem[] }) => setItems(d.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <Panel
      title="Low Stock Alerts"
      icon={<AlertTriangle className="h-3.5 w-3.5" style={{ color: "#f59e0b" }} />}
      count={items.length}
      accentColor="#f59e0b"
    >
      {loading ? (
        <div className="p-3 space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 rounded animate-pulse" style={{ background: "#252836" }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center text-[11px]" style={{ color: "#3a4255" }}>
          All products are well stocked.
        </div>
      ) : (
        <div>
          {items.map((item, i) => (
            <div
              key={item.variantId}
              className="flex items-center justify-between px-4 py-2"
              style={{ borderBottom: i < items.length - 1 ? "1px solid #1f2330" : "none" }}
            >
              <div className="min-w-0">
                <p className="text-[11px] font-medium truncate" style={{ color: "#c8d0e0" }}>{item.productName}</p>
                <p className="text-[10px] truncate" style={{ color: "#3a4255" }}>{item.variantName} · {item.sku}</p>
              </div>
              <span
                className="ml-3 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={item.stockCount === 0
                  ? { background: "#2a0f0f", color: "#f87171" }
                  : { background: "#2a1f0a", color: "#f59e0b" }
                }
              >
                {item.stockCount === 0 ? "Out of stock" : `${item.stockCount} left`}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function PendingReviewsSection() {
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    fetch(`${API_URL}/admin/dashboard/pending-reviews`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: { reviews: PendingReview[] }) => setReviews(d.reviews))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const approve = async (id: number) => {
    const res = await fetch(`${API_URL}/admin/dashboard/reviews/${id}/approve`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setReviews((p) => p.filter((r) => r.id !== id));
  };

  const reject = async (id: number) => {
    const res = await fetch(`${API_URL}/admin/dashboard/reviews/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setReviews((p) => p.filter((r) => r.id !== id));
  };

  return (
    <Panel
      title="Pending Reviews"
      icon={<Star className="h-3.5 w-3.5" style={{ color: "#eab308" }} />}
      count={reviews.length}
      accentColor="#eab308"
    >
      {loading ? (
        <div className="p-3 space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded animate-pulse" style={{ background: "#252836" }} />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="py-6 text-center text-[11px]" style={{ color: "#3a4255" }}>
          No pending reviews.
        </div>
      ) : (
        <div>
          {reviews.map((r, i) => (
            <div
              key={r.id}
              className="flex items-start gap-3 px-4 py-2.5"
              style={{ borderBottom: i < reviews.length - 1 ? "1px solid #1f2330" : "none" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium" style={{ color: "#c8d0e0" }}>{r.userName}</span>
                  <span className="text-[10px]" style={{ color: "#3a4255" }}>on</span>
                  <span className="text-[11px] truncate max-w-[120px]" style={{ color: "#8b94a8" }}>{r.productName}</span>
                </div>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      className="h-2.5 w-2.5"
                      style={{ fill: idx < r.rating ? "#eab308" : "transparent", color: idx < r.rating ? "#eab308" : "#2a2d3a" }}
                    />
                  ))}
                </div>
                {r.title && <p className="text-[11px] font-medium mt-0.5 truncate" style={{ color: "#c8d0e0" }}>{r.title}</p>}
                {r.body && <p className="text-[10px] line-clamp-1 mt-0.5" style={{ color: "#4a5568" }}>{r.body}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => approve(r.id)}
                  className="flex h-6 w-6 items-center justify-center rounded transition-colors"
                  style={{ background: "#0a2015", color: "#4ade80" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#0f2e1a"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#0a2015"}
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={() => reject(r.id)}
                  className="flex h-6 w-6 items-center justify-center rounded transition-colors"
                  style={{ background: "#2a0f0f", color: "#f87171" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#3a1212"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#2a0f0f"}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

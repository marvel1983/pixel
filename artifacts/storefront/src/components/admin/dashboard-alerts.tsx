import { useEffect, useState } from "react";
import { AlertTriangle, Star, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface LowStockItem {
  variantId: number;
  productName: string;
  variantName: string;
  sku: string;
  stockCount: number;
  lowStockThreshold: number;
}

interface PendingReview {
  id: number;
  productName: string;
  userName: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
}

export function LowStockSection() {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    fetch(`${API_URL}/admin/dashboard/low-stock`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { items: LowStockItem[] }) => setItems(data.items))
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
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b px-6 py-4">
        <AlertTriangle className="h-5 w-5 text-orange-500" />
        <h2 className="text-lg font-semibold">Low Stock Alerts</h2>
        {items.length > 0 && (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            {items.length}
          </Badge>
        )}
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground">
          All products are well stocked.
        </div>
      ) : (
        <div className="divide-y">
          {items.map((item) => (
            <div key={item.variantId} className="flex items-center justify-between px-6 py-3">
              <div>
                <p className="font-medium text-sm">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.variantName} · {item.sku}
                </p>
              </div>
              <Badge
                variant="secondary"
                className={
                  item.stockCount === 0
                    ? "bg-red-100 text-red-800"
                    : "bg-orange-100 text-orange-800"
                }
              >
                {item.stockCount === 0 ? "Out of stock" : `${item.stockCount} left`}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PendingReviewsSection() {
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    fetch(`${API_URL}/admin/dashboard/pending-reviews`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { reviews: PendingReview[] }) => setReviews(data.reviews))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleApprove = async (id: number) => {
    await fetch(`${API_URL}/admin/dashboard/reviews/${id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setReviews((prev) => prev.filter((r) => r.id !== id));
  };

  const handleReject = async (id: number) => {
    await fetch(`${API_URL}/admin/dashboard/reviews/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setReviews((prev) => prev.filter((r) => r.id !== id));
  };

  if (loading) {
    return (
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="p-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b px-6 py-4">
        <Star className="h-5 w-5 text-yellow-500" />
        <h2 className="text-lg font-semibold">Pending Reviews</h2>
        {reviews.length > 0 && (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            {reviews.length}
          </Badge>
        )}
      </div>
      {reviews.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground">
          No pending reviews.
        </div>
      ) : (
        <div className="divide-y">
          {reviews.map((review) => (
            <div key={review.id} className="px-6 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{review.userName}</span>
                    <span className="text-muted-foreground">on</span>
                    <span className="font-medium truncate">{review.productName}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                      />
                    ))}
                  </div>
                  {review.title && (
                    <p className="mt-1 text-sm font-medium">{review.title}</p>
                  )}
                  {review.body && (
                    <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                      {review.body}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-green-600 hover:bg-green-50"
                    onClick={() => handleApprove(review.id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                    onClick={() => handleReject(review.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { X, ShoppingBag, Package } from "lucide-react";
import { useRecentPurchases, type RecentPurchase } from "@/hooks/use-social-proof";
import { useLocation } from "wouter";

const SP_TOAST_COUNT_KEY = "sp_toast_count";

function getToastCount(): number {
  return Number(sessionStorage.getItem(SP_TOAST_COUNT_KEY) || 0);
}
function incrementToastCount() {
  sessionStorage.setItem(SP_TOAST_COUNT_KEY, String(getToastCount() + 1));
}

function formatTimeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff === 1) return "1 minute ago";
  if (diff < 60) return `${diff} minutes ago`;
  const hours = Math.floor(diff / 60);
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

function randomDelay(min: number, max: number): number {
  return (min + Math.random() * (max - min)) * 1000;
}

export function PurchaseToastProvider() {
  const { purchases, config } = useRecentPurchases();
  const [current, setCurrent] = useState<RecentPurchase | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [location] = useLocation();

  const isAllowedPage =
    location === "/" || location === "/shop" || location.startsWith("/product/");

  useEffect(() => {
    if (!config.toastEnabled || !purchases.length || !isAllowedPage) return;
    if (getToastCount() >= config.toastMaxPerSession) return;

    function scheduleNext() {
      if (getToastCount() >= config.toastMaxPerSession) return;
      const delay = randomDelay(config.toastIntervalMin, config.toastIntervalMax);
      timerRef.current = setTimeout(() => {
        if (getToastCount() >= config.toastMaxPerSession) return;
        const idx = getToastCount() % purchases.length;
        setCurrent(purchases[idx]);
        setVisible(true);
        incrementToastCount();
        setTimeout(() => {
          setVisible(false);
          scheduleNext();
        }, 6000);
      }, delay);
    }

    scheduleNext();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [config.toastEnabled, config.toastIntervalMin, config.toastIntervalMax, config.toastMaxPerSession, purchases, isAllowedPage]);

  if (!current || !visible) return null;

  const cityText = current.customerCity ? ` from ${current.customerCity}` : "";

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300 max-w-xs">
      <div className="bg-card border border-border rounded-lg shadow-lg p-3 flex gap-3 items-start">
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
          {current.productImageUrl ? (
            <img src={current.productImageUrl} alt="" className="w-10 h-10 rounded object-cover" />
          ) : (
            <Package className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-xs text-green-600 font-medium mb-0.5">
            <ShoppingBag className="h-3 w-3" />
            Recent purchase
          </div>
          <p className="text-sm text-foreground line-clamp-2">
            <span className="font-medium">{current.customerName}</span>
            {cityText} bought{" "}
            <span className="font-medium">{current.productName}</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {formatTimeAgo(current.createdAt)}
          </p>
        </div>
        <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground p-0.5">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

import { Link } from "wouter";
import { GitCompareArrows, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompareStore } from "@/stores/compare-store";
import { MOCK_PRODUCTS } from "@/lib/mock-data";

export function CompareBar() {
  const { productIds, removeProduct, clearAll } = useCompareStore();

  if (productIds.length === 0) return null;

  const products = MOCK_PRODUCTS.filter((p) => productIds.includes(p.id));

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-background border border-border rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3">
        {/* Icon + count */}
        <div className="flex items-center gap-2 shrink-0">
          <GitCompareArrows className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Compare ({productIds.length}/4)
          </span>
        </div>

        {/* Product thumbnails */}
        <div className="flex items-center gap-2 flex-1 overflow-hidden">
          {products.map((p) => (
            <div key={p.id} className="relative shrink-0 group">
              <div className="w-10 h-10 rounded-lg border border-border bg-muted overflow-hidden">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted" />
                )}
              </div>
              <button
                onClick={() => removeProduct(p.id)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove ${p.name}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          {/* Empty slots */}
          {Array.from({ length: 4 - products.length }).map((_, i) => (
            <div
              key={i}
              className="w-10 h-10 rounded-lg border border-dashed border-border bg-muted/40 shrink-0"
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
          <Link href="/compare">
            <Button size="sm" className="h-8 text-xs gap-1.5">
              Compare <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

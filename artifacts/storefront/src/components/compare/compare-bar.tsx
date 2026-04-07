import { useEffect, useState } from "react";
import { Link } from "wouter";
import { GitCompareArrows, X, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompareStore } from "@/stores/compare-store";
import { MOCK_PRODUCTS, type MockProduct } from "@/lib/mock-data";

export function CompareBar() {
  const { productIds, removeProduct, clearAll } = useCompareStore();
  const [products, setProducts] = useState<MockProduct[]>([]);

  useEffect(() => {
    if (productIds.length === 0) {
      setProducts([]);
      return;
    }
    const idSet = new Set(productIds);
    setProducts(MOCK_PRODUCTS.filter((p) => idSet.has(p.id)));
  }, [productIds]);

  if (productIds.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
      <div className="container mx-auto px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-medium shrink-0">
          <GitCompareArrows className="h-4 w-4 text-primary" />
          Compare ({productIds.length}/4)
        </div>

        <div className="flex items-center gap-2 flex-1 overflow-x-auto">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1 shrink-0"
            >
              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover rounded" />
                ) : (
                  <Package className="h-4 w-4 text-muted-foreground/50" />
                )}
              </div>
              <span className="text-xs max-w-[100px] truncate">{p.name}</span>
              <button onClick={() => removeProduct(p.id)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={clearAll}>
            Clear
          </Button>
          <Link href="/compare">
            <Button size="sm">
              <GitCompareArrows className="h-3 w-3 mr-1" /> Compare Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

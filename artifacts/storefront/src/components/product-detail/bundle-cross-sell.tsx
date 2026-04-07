import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Package, Tag, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrencyStore } from "@/stores/currency-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface BundleItem { productId: number; productName: string; minPrice: string; }
interface BundleCrossSell {
  id: number; name: string; slug: string; bundlePriceUsd: string;
  items: BundleItem[]; individualTotal: string;
}

export function BundleCrossSell({ productId }: { productId: number }) {
  const [bundles, setBundles] = useState<BundleCrossSell[]>([]);
  const format = useCurrencyStore((s) => s.format);

  useEffect(() => {
    if (!productId) return;
    fetch(`${API}/bundles/by-product/${productId}`)
      .then((r) => r.json())
      .then(setBundles)
      .catch(() => {});
  }, [productId]);

  if (!bundles.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Package className="h-5 w-5" /> Save with Bundles
      </h3>
      {bundles.slice(0, 2).map((b) => {
        const savings = parseFloat(b.individualTotal) - parseFloat(b.bundlePriceUsd);
        const savingsPct = Math.round((savings / parseFloat(b.individualTotal)) * 100);
        return (
          <Card key={b.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium line-clamp-1">{b.name}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {b.items.slice(0, 3).map((item) => (
                      <Badge key={item.productId} variant="outline" className="text-xs">{item.productName}</Badge>
                    ))}
                    {b.items.length > 3 && <Badge variant="outline" className="text-xs">+{b.items.length - 3}</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-bold text-blue-600">{format(parseFloat(b.bundlePriceUsd))}</span>
                    <span className="text-sm text-muted-foreground line-through">{format(parseFloat(b.individualTotal))}</span>
                    {savingsPct > 0 && (
                      <Badge className="bg-green-100 text-green-800 text-xs">-{savingsPct}%</Badge>
                    )}
                  </div>
                </div>
                <Link href={`/bundles/${b.slug}`}>
                  <Button variant="outline" size="sm">
                    View <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

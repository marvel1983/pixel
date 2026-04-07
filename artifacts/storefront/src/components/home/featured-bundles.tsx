import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Package, ArrowRight, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrencyStore } from "@/stores/currency-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface BundleItem { productId: number; productName: string; productImage: string | null; minPrice: string; }
interface FeaturedBundle {
  id: number; name: string; slug: string; shortDescription: string | null;
  imageUrl: string | null; bundlePriceUsd: string; isFeatured: boolean;
  items: BundleItem[]; individualTotal: string;
}

export function FeaturedBundles() {
  const [bundles, setBundles] = useState<FeaturedBundle[]>([]);
  const format = useCurrencyStore((s) => s.format);

  useEffect(() => {
    fetch(`${API}/bundles`)
      .then((r) => r.json())
      .then((data: FeaturedBundle[]) => setBundles(data.filter((b) => b.isFeatured).slice(0, 3)))
      .catch(() => {});
  }, []);

  if (!bundles.length) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" /> Featured Bundles
        </h2>
        <Link href="/bundles">
          <Button variant="ghost" size="sm">View All <ArrowRight className="h-4 w-4 ml-1" /></Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {bundles.map((b) => {
          const savings = parseFloat(b.individualTotal) - parseFloat(b.bundlePriceUsd);
          const savingsPct = Math.round((savings / parseFloat(b.individualTotal)) * 100);
          return (
            <Link key={b.id} href={`/bundles/${b.slug}`}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group overflow-hidden">
                <div className="relative aspect-[3/2] bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                  {b.imageUrl ? <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" />
                    : <Package className="h-12 w-12 text-blue-300" />}
                  {savingsPct > 0 && (
                    <Badge className="absolute top-2 right-2 bg-green-600 text-white">Save {savingsPct}%</Badge>
                  )}
                </div>
                <CardContent className="p-3 space-y-2">
                  <h3 className="font-semibold group-hover:text-blue-600 transition-colors line-clamp-1">{b.name}</h3>
                  <div className="flex flex-wrap gap-1">
                    {b.items.slice(0, 3).map((item) => (
                      <div key={item.productId} className="w-7 h-7 rounded bg-muted flex items-center justify-center">
                        {item.productImage ? <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover rounded" />
                          : <Package className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    ))}
                    {b.items.length > 3 && <span className="text-xs text-muted-foreground self-center">+{b.items.length - 3}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-600">{format(parseFloat(b.bundlePriceUsd))}</span>
                    <span className="text-sm text-muted-foreground line-through">{format(parseFloat(b.individualTotal))}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

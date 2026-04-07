import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Package, Tag, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrencyStore } from "@/stores/currency-store";
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface BundleItem {
  productId: number;
  productName: string;
  productSlug: string;
  productImage: string | null;
  minPrice: string;
}

interface BundleListing {
  id: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  imageUrl: string | null;
  bundlePriceUsd: string;
  isFeatured: boolean;
  items: BundleItem[];
  individualTotal: string;
}

export default function BundlesPage() {
  const [bundles, setBundles] = useState<BundleListing[]>([]);
  const [loading, setLoading] = useState(true);
  const format = useCurrencyStore((s) => s.format);

  useEffect(() => {
    setSeoMeta({ title: "Product Bundles | PixelCodes", description: "Save more with curated software bundles" });
    fetch(`${API}/bundles`)
      .then((r) => r.json())
      .then(setBundles)
      .catch(() => {})
      .finally(() => setLoading(false));
    return clearSeoMeta;
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      </div>
    );
  }

  if (!bundles.length) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold mb-2">No Bundles Available</h1>
        <p className="text-muted-foreground">Check back later for special bundle offers.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Product Bundles</h1>
        <p className="text-muted-foreground mt-1">Save more when you buy together</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bundles.map((b) => {
          const savings = parseFloat(b.individualTotal) - parseFloat(b.bundlePriceUsd);
          const savingsPct = Math.round((savings / parseFloat(b.individualTotal)) * 100);
          return (
            <Link key={b.id} href={`/bundles/${b.slug}`}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group overflow-hidden">
                <div className="relative aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-16 w-16 text-blue-300" />
                  )}
                  {savingsPct > 0 && (
                    <Badge className="absolute top-3 right-3 bg-green-600 text-white text-sm px-2 py-1">
                      Save {savingsPct}%
                    </Badge>
                  )}
                  {b.isFeatured && (
                    <Badge className="absolute top-3 left-3 bg-amber-500 text-white">Featured</Badge>
                  )}
                </div>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold text-lg group-hover:text-blue-600 transition-colors line-clamp-1">{b.name}</h3>
                  {b.shortDescription && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{b.shortDescription}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {b.items.slice(0, 4).map((item) => (
                      <Badge key={item.productId} variant="secondary" className="text-xs">
                        {item.productName}
                      </Badge>
                    ))}
                    {b.items.length > 4 && (
                      <Badge variant="outline" className="text-xs">+{b.items.length - 4} more</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <span className="text-lg font-bold text-blue-600">{format(parseFloat(b.bundlePriceUsd))}</span>
                      <span className="text-sm text-muted-foreground line-through ml-2">{format(parseFloat(b.individualTotal))}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="text-blue-600">
                      View <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

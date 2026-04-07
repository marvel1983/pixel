import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Package, Check, ShoppingCart, ArrowLeft, Loader2, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { useToast } from "@/hooks/use-toast";
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface BundleVariant { id: number; name: string; priceUsd: string; platform: string | null; }
interface BundleItem {
  productId: number; productName: string; productSlug: string;
  productImage: string | null; minPrice: string; variants: BundleVariant[];
}
interface BundleDetail {
  id: number; name: string; slug: string; description: string | null;
  shortDescription: string | null; imageUrl: string | null; bundlePriceUsd: string;
  metaTitle: string | null; metaDescription: string | null;
  items: BundleItem[]; individualTotal: string;
}

export default function BundleDetailPage() {
  const params = useParams<{ slug: string }>();
  const [bundle, setBundle] = useState<BundleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const addItem = useCartStore((s) => s.addItem);
  const format = useCurrencyStore((s) => s.format);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/bundles/${params.slug}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((b) => {
        setBundle(b);
        setSeoMeta({
          title: b.metaTitle || `${b.name} | PixelCodes`,
          description: b.metaDescription || b.shortDescription || "",
        });
      })
      .catch(() => setBundle(null))
      .finally(() => setLoading(false));
    return clearSeoMeta;
  }, [params.slug]);

  if (loading) return <div className="container mx-auto px-4 py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
  if (!bundle) return <div className="container mx-auto px-4 py-12 text-center"><h1 className="text-2xl font-bold">Bundle Not Found</h1></div>;

  const savings = parseFloat(bundle.individualTotal) - parseFloat(bundle.bundlePriceUsd);
  const savingsPct = Math.round((savings / parseFloat(bundle.individualTotal)) * 100);

  function addBundleToCart() {
    for (const item of bundle!.items) {
      const v = item.variants[0];
      if (!v) continue;
      const discountRatio = parseFloat(bundle!.bundlePriceUsd) / parseFloat(bundle!.individualTotal);
      const discountedPrice = (parseFloat(v.priceUsd) * discountRatio).toFixed(2);
      addItem({
        variantId: v.id,
        productId: item.productId,
        productName: item.productName,
        variantName: `${v.name} (Bundle)`,
        imageUrl: item.productImage,
        priceUsd: discountedPrice,
        platform: v.platform ?? undefined,
      });
    }
    toast({ title: "Bundle added to cart!", description: `${bundle!.name} has been added.` });
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Link href="/bundles" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> All Bundles
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{bundle.name}</h1>
            {bundle.shortDescription && <p className="text-lg text-muted-foreground mt-2">{bundle.shortDescription}</p>}
          </div>

          {bundle.description && (
            <Card>
              <CardContent className="pt-6 prose prose-sm max-w-none">
                <div dangerouslySetInnerHTML={{ __html: bundle.description }} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> What's Included ({bundle.items.length} products)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {bundle.items.map((item) => (
                <div key={item.productId} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    {item.productImage ? (
                      <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover rounded" />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/product/${item.productSlug}`} className="font-medium hover:text-blue-600 transition-colors line-clamp-1">{item.productName}</Link>
                    <div className="flex gap-1 mt-0.5">
                      {item.variants.slice(0, 3).map((v) => (
                        <Badge key={v.id} variant="outline" className="text-xs">{v.platform ?? v.name}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm text-muted-foreground line-through">{format(parseFloat(item.minPrice))}</span>
                    <Check className="h-4 w-4 text-green-600 inline ml-1" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardContent className="pt-6 space-y-4">
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">Bundle Price</p>
                <p className="text-3xl font-bold text-blue-600">{format(parseFloat(bundle.bundlePriceUsd))}</p>
                <p className="text-sm text-muted-foreground line-through">{format(parseFloat(bundle.individualTotal))}</p>
              </div>
              {savings > 0 && (
                <div className="flex items-center justify-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <Tag className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-700">You save {format(savings)} ({savingsPct}%)</span>
                </div>
              )}
              <Separator />
              <Button onClick={addBundleToCart} className="w-full" size="lg">
                <ShoppingCart className="h-5 w-5 mr-2" /> Add Bundle to Cart
              </Button>
              <p className="text-xs text-center text-muted-foreground">Instant digital delivery for all products</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

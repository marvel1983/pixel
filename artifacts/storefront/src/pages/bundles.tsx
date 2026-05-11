import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Package, Tag, ArrowRight, Loader2 } from "lucide-react";
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
  const { t } = useTranslation();
  const [bundles, setBundles] = useState<BundleListing[]>([]);
  const [loading, setLoading] = useState(true);
  const format = useCurrencyStore((s) => s.format);

  useEffect(() => {
    setSeoMeta({ title: t("seo.bundlesTitle"), description: t("seo.bundlesDescription") });
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
        <h1 className="text-2xl font-bold mb-2">{t("bundles.noBundles")}</h1>
        <p className="text-muted-foreground">{t("bundles.noBundlesDesc")}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("bundles.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("bundles.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {bundles.map((b) => {
          const savings = parseFloat(b.individualTotal) - parseFloat(b.bundlePriceUsd);
          const savingsPct = Math.round((savings / parseFloat(b.individualTotal)) * 100);
          return (
            <Link key={b.id} href={`/bundles/${b.slug}`}>
              <div className="group bg-card border border-border rounded-lg hover:shadow-lg hover:-translate-y-0.5 transition-[shadow,transform] duration-150 h-full flex flex-col">
                <div className="relative aspect-[3/4] shrink-0 rounded-t-lg">
                  <div className="absolute inset-0 overflow-hidden rounded-t-lg bg-white">
                    {b.imageUrl ? (
                      <img src={b.imageUrl} alt={b.name} className="h-full w-full object-contain p-3" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  {savingsPct > 0 && (
                    <Badge className="absolute left-2 top-2 z-10 bg-green-600 text-white text-[10px] px-1.5 py-0.5 pointer-events-none">
                      -{savingsPct}%
                    </Badge>
                  )}
                  {b.isFeatured && (
                    <Badge className="absolute right-2 top-2 z-10 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 pointer-events-none">{t("bundles.featured")}</Badge>
                  )}
                </div>
                <div className="flex flex-1 flex-col items-center p-3 text-center">
                  <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1 group-hover:text-primary transition-colors">{b.name}</h3>
                  <div className="flex -space-x-1.5 mb-2">
                    {b.items.slice(0, 4).map((item) => (
                      <div key={item.productId} className="w-6 h-6 rounded-full border border-white bg-muted flex items-center justify-center overflow-hidden" title={item.productName}>
                        {item.productImage ? (
                          <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                    {b.items.length > 4 && (
                      <span className="text-[10px] text-muted-foreground self-center pl-1">+{b.items.length - 4}</span>
                    )}
                  </div>
                  <div className="mt-auto flex flex-col gap-2 pt-2 w-full">
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-lg font-bold leading-tight text-foreground">{format(parseFloat(b.bundlePriceUsd))}</span>
                      <span className="text-xs leading-tight text-muted-foreground line-through">{format(parseFloat(b.individualTotal))}</span>
                    </div>
                    <Button variant="default" size="sm" className="h-9 w-full gap-2 rounded-lg border-0 px-3 text-xs font-semibold text-white bg-primary hover:bg-primary/90">
                      {t("bundles.view")} <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

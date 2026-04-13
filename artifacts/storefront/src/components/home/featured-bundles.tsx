import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Package, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/home/page-section";
import { useCurrencyStore } from "@/stores/currency-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface BundleItem {
  productId: number;
  productName: string;
  productImage: string | null;
  minPrice: string;
}
interface FeaturedBundle {
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

export function FeaturedBundles() {
  const { t } = useTranslation();
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
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeader
          className="mb-0 sm:max-w-xl"
          eyebrow={t("home.sectionEyebrowShop")}
          title={t("home.featuredBundles")}
          subtitle={t("home.bundlesSubtitle")}
          id="section-bundles"
        />
        <Link href="/bundles" className="shrink-0">
          <Button variant="outline" size="sm">
            {t("home.bundlesViewAll")}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {bundles.map((b) => {
          const savings = parseFloat(b.individualTotal) - parseFloat(b.bundlePriceUsd);
          const savingsPct = Math.round((savings / parseFloat(b.individualTotal)) * 100);
          return (
            <Link key={b.id} href={`/bundles/${b.slug}`}>
              <Card className="group h-full cursor-pointer overflow-hidden transition-shadow hover:shadow-lg">
                <div className="relative aspect-[3/2]">
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5">
                    {b.imageUrl ? (
                      <img src={b.imageUrl} alt={b.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-12 w-12 text-primary/35" />
                    )}
                  </div>
                  {savingsPct > 0 && (
                    <Badge className="no-default-hover-elevate pointer-events-none absolute right-2 top-2 z-10 max-w-[calc(100%-1rem)] truncate bg-primary text-primary-foreground shadow-sm">
                      {t("home.bundleSavePct", { pct: savingsPct })}
                    </Badge>
                  )}
                </div>
                <CardContent className="space-y-2 p-3">
                  <h3 className="line-clamp-1 font-semibold transition-colors group-hover:text-primary">{b.name}</h3>
                  <div className="flex flex-wrap gap-1">
                    {b.items.slice(0, 3).map((item) => (
                      <div key={item.productId} className="flex h-7 w-7 items-center justify-center rounded bg-muted">
                        {item.productImage ? (
                          <img
                            src={item.productImage}
                            alt={item.productName}
                            className="h-full w-full rounded object-cover"
                          />
                        ) : (
                          <Package className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                    {b.items.length > 3 && (
                      <span className="self-center text-xs text-muted-foreground">+{b.items.length - 3}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">{format(parseFloat(b.bundlePriceUsd))}</span>
                    <span className="text-sm text-muted-foreground line-through">
                      {format(parseFloat(b.individualTotal))}
                    </span>
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

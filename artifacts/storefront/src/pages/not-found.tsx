import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
import { useCurrencyStore } from "@/stores/currency-store";

const featuredProducts = MOCK_PRODUCTS.filter((p) => p.isFeatured).slice(0, 4).length >= 4
  ? MOCK_PRODUCTS.filter((p) => p.isFeatured).slice(0, 4)
  : MOCK_PRODUCTS.slice(0, 4);

export default function NotFound() {
  const { t } = useTranslation();
  const format = useCurrencyStore((s) => s.format);

  return (
    <div className="min-h-screen bg-background py-16 px-4">
      {/* Error section */}
      <div className="flex flex-col items-center justify-center text-center mb-16">
        <SearchX className="h-24 w-24 text-muted-foreground/40 mb-6" />
        <h1 className="text-6xl font-extrabold text-foreground mb-3">404</h1>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          {t("notFound.title", { defaultValue: "Page Not Found" })}
        </h2>
        <p className="text-muted-foreground max-w-md mb-8">
          {t("notFound.description", {
            defaultValue:
              "The page you're looking for doesn't exist or may have been moved. Let's get you back on track.",
          })}
        </p>
        <Link href="/">
          <Button size="lg">Back to Home</Button>
        </Link>
      </div>

      {/* Popular Products section */}
      <div className="max-w-5xl mx-auto">
        <h3 className="text-xl font-bold text-center mb-8 text-foreground">
          Popular Products
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {featuredProducts.map((product) => {
            const variant = product.variants?.[0];
            if (!variant) return null;
            const price = parseFloat(variant.priceUsd);
            const comparePrice = variant.compareAtPriceUsd
              ? parseFloat(variant.compareAtPriceUsd)
              : null;

            return (
              <Link key={product.id} href={`/product/${product.slug}`}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                  <CardContent className="p-0 flex flex-col h-full">
                    <div className="aspect-[4/3] bg-muted rounded-t-lg overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                          <SearchX className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col flex-1">
                      <p className="text-sm font-medium text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                        {product.name}
                      </p>
                      <div className="mt-auto flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-base font-bold text-foreground">
                          {format(price)}
                        </span>
                        {comparePrice != null && (
                          <span className="text-xs text-muted-foreground line-through">
                            {format(comparePrice)}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

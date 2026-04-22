import { Badge } from "@/components/ui/badge";
import { Zap, Star } from "lucide-react";
import { ViewerCount } from "@/components/social-proof/viewer-count";
import { SoldBadge } from "@/components/social-proof/sold-badge";
import { RegionBadge } from "@/components/product/region-badge";
import { PlatformBadge, ActivationGuideLink } from "@/components/product/platform-badge";
import { VolumePricing } from "@/components/product-detail/volume-pricing";
import type { MockProduct, MockVariant } from "@/lib/mock-data";

interface ProductMetaProps {
  product: MockProduct;
  selectedVariant: MockVariant;
  onVariantChange: (v: MockVariant) => void;
}

export function ProductMeta({ product, selectedVariant, onVariantChange }: ProductMetaProps) {
  const basePrice = parseFloat(selectedVariant.priceUsd);
  const compareAt = selectedVariant.compareAtPriceUsd
    ? parseFloat(selectedVariant.compareAtPriceUsd)
    : null;
  const discount = compareAt ? Math.round((1 - basePrice / compareAt) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        {product.isNew && discount === 0 && (
          <Badge className="bg-green-500">NEW</Badge>
        )}
        {discount > 0 && (
          <Badge variant="destructive">-{discount}%</Badge>
        )}
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-foreground leading-tight">{product.name}</h1>

      {/* Star ratings */}
      <div className="flex items-center gap-2">
        <div className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${i < Math.round(product.avgRating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {product.avgRating} ({product.reviewCount} reviews)
        </span>
      </div>

      {/* Social proof */}
      <ViewerCount productId={product.id} />
      <SoldBadge productId={product.id} />

      {/* Region + Platform */}
      <div className="flex items-center gap-2 flex-wrap">
        <RegionBadge regions={product.regionRestrictions ?? []} />
        <PlatformBadge platformType={product.platformType} />
      </div>

      <ActivationGuideLink platformType={product.platformType} />

      {/* Variant selector */}
      {product.variants.length > 1 && (
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Edition</label>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <button
                key={v.id}
                onClick={() => onVariantChange(v)}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  v.id === selectedVariant.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Volume pricing */}
      <VolumePricing productId={product.id} basePrice={selectedVariant.priceUsd} />
    </div>
  );
}

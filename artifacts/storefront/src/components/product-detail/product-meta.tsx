import { Badge } from "@/components/ui/badge";
import { Globe, Monitor, Key, Package, Shield, RotateCcw, Headphones, Zap, Star } from "lucide-react";
import { ViewerCount } from "@/components/social-proof/viewer-count";
import { SoldBadge } from "@/components/social-proof/sold-badge";
import { ActivationGuideLink } from "@/components/product/platform-badge";
import { VolumePricing } from "@/components/product-detail/volume-pricing";
import type { MockProduct, MockVariant } from "@/lib/mock-data";

interface ProductMetaProps {
  product: MockProduct;
  selectedVariant: MockVariant;
  onVariantChange: (v: MockVariant) => void;
}

const PLATFORM_LABEL: Record<string, string> = {
  STEAM: "Steam",
  WINDOWS: "Windows",
  XBOX: "Xbox",
  PSN: "PlayStation",
  NINTENDO: "Nintendo",
};

const WORKS_ON: Record<string, string> = {
  STEAM: "Windows, Mac, Linux",
  WINDOWS: "Windows",
  XBOX: "Xbox console",
  PSN: "PlayStation console",
  NINTENDO: "Nintendo Switch",
};

export function ProductMeta({ product, selectedVariant, onVariantChange }: ProductMetaProps) {
  const basePrice = parseFloat(selectedVariant.priceUsd);
  const compareAt = selectedVariant.compareAtPriceUsd ? parseFloat(selectedVariant.compareAtPriceUsd) : null;
  const discount = compareAt ? Math.round((1 - basePrice / compareAt) * 100) : 0;
  const platform = product.platformType ?? selectedVariant.platform ?? "WINDOWS";
  const platformLabel = PLATFORM_LABEL[platform] ?? platform;
  const worksOn = WORKS_ON[platform] ?? "Windows";

  return (
    <div className="border rounded-lg p-5 bg-card space-y-4">
      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {product.isNew && discount === 0 && <Badge className="bg-green-500">NEW</Badge>}
        {discount > 0 && <Badge variant="destructive">-{discount}%</Badge>}
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-foreground leading-tight">{product.name}</h1>

      {/* Ratings */}
      <div className="flex items-center gap-2">
        <div className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`h-4 w-4 ${i < Math.round(product.avgRating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">{product.avgRating} ({product.reviewCount} reviews)</span>
      </div>

      <ViewerCount productId={product.id} />
      <SoldBadge productId={product.id} />

      {/* 2×2 Feature grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="border rounded-lg p-3 flex items-start gap-2">
          <Globe className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold">Global</p>
            <p className="text-xs text-muted-foreground">Can be activated worldwide · Check region restrictions</p>
          </div>
        </div>
        <div className="border rounded-lg p-3 flex items-start gap-2">
          <Monitor className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold">{platformLabel}</p>
            <p className="text-xs text-muted-foreground">Activate/redeem on {platformLabel} · Check activation guide</p>
          </div>
        </div>
        <div className="border rounded-lg p-3 flex items-start gap-2">
          <Key className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold">Digital Key Delivery</p>
            <p className="text-xs text-muted-foreground">CD-KEY · Instant delivery by email</p>
          </div>
        </div>
        <div className="border rounded-lg p-3 flex items-start gap-2">
          <Package className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold">Works on</p>
            <p className="text-xs text-muted-foreground">{worksOn}</p>
          </div>
        </div>
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

      <VolumePricing productId={product.id} basePrice={selectedVariant.priceUsd} />

      {/* Trust badges */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-xs text-muted-foreground">Secure Payment</span>
        </div>
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-xs text-muted-foreground">Money Back Guarantee</span>
        </div>
        <div className="flex items-center gap-2">
          <Headphones className="h-4 w-4 text-purple-600 shrink-0" />
          <span className="text-xs text-muted-foreground">24/7 Support</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500 shrink-0" />
          <span className="text-xs text-muted-foreground">Instant Delivery</span>
        </div>
      </div>
    </div>
  );
}

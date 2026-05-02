import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Globe, Monitor, Key, Package, Star } from "lucide-react";
import { ViewerCount } from "@/components/social-proof/viewer-count";
import { SoldBadge } from "@/components/social-proof/sold-badge";
import { ActivationGuideLink } from "@/components/product/platform-badge";
import { VolumePricing } from "@/components/product-detail/volume-pricing";
import { INFO_ICON_MAP, ACCENT_BY_ICON } from "@/lib/info-tile-icons";
import type { MockProduct, MockVariant } from "@/lib/mock-data";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface ProductMetaProps {
  product: MockProduct;
  selectedVariant: MockVariant;
  onVariantChange: (v: MockVariant) => void;
}

type Tag = { id: number; name: string; slug: string; colorHex: string | null };

const REGION_SUBTITLE: Record<string, string> = {
  "Global":          "Can be activated worldwide · Check region restrictions",
  "EU":              "European Union · EU region keys only",
  "European Union":  "European Union · EU region keys only",
  "Europe":          "European countries · EU/EEA region only",
  "USA":             "United States · US activation only",
  "US":              "United States · US activation only",
  "UK":              "United Kingdom · UK activation only",
  "Germany":         "Germany · DE region only",
  "France":          "France · FR region only",
  "Croatia":         "Croatia · HR region only",
  "Austria":         "Austria · AT region only",
  "Poland":          "Poland · PL region only",
  "Australia":       "Australia · AU region only",
  "Canada":          "Canada · CA region only",
  "Brazil":          "Brazil · BR region only",
  "Russia":          "Russia · RU region only",
};

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
  const [guaranteeTiles, setGuaranteeTiles] = useState<Array<{ icon: string; label: string; sub: string }>>([]);

  useEffect(() => {
    fetch(`${API_URL}/guarantee-tiles`).then((r) => r.json()).then((d) => setGuaranteeTiles(d.tiles ?? [])).catch(() => {});
  }, []);

  const basePrice = parseFloat(selectedVariant.priceUsd);
  const compareAt = selectedVariant.compareAtPriceUsd ? parseFloat(selectedVariant.compareAtPriceUsd) : null;
  const discount = compareAt ? Math.round((1 - basePrice / compareAt) * 100) : 0;
  const platform = product.platformType ?? selectedVariant.platform ?? "WINDOWS";
  const platformLabel = PLATFORM_LABEL[platform] ?? platform;
  const worksOn = WORKS_ON[platform] ?? "Windows";

  // Derive region label: REGION attribute → Globe custom tile → "Global" fallback
  const regionAttr = product.productAttributes?.find((a) => a.attrSlug === "region");
  const regionTile = product.customInfoTiles?.find((t) => t.icon === "Globe");
  const regionLabel = regionAttr?.optValue ?? regionTile?.title ?? "Global";
  const regionSub = regionTile?.subtitle ?? REGION_SUBTITLE[regionLabel] ?? `${regionLabel} · Regional activation only`;
  const extraTiles = product.customInfoTiles?.filter((t) => t.icon !== "Globe") ?? [];

  return (
    <div className="border rounded-lg p-5 bg-card space-y-4 h-full">
      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {product.isNew && discount === 0 && <Badge className="bg-green-500">NEW</Badge>}
        {discount > 0 && <Badge variant="destructive">-{discount}%</Badge>}
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-foreground leading-tight">{product.name}</h1>

      {/* Tags */}
      {product.tags && product.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {product.tags.map((tag: Tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: tag.colorHex || "#3b82f6" }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

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

      {/* Auto-generated + custom info tiles */}
      <div className="grid grid-cols-2 gap-2">
        <div className="border rounded-lg p-3 flex items-start gap-2">
          <Globe className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold">{regionLabel}</p>
            <p className="text-xs text-muted-foreground">{regionSub}</p>
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
        {extraTiles.map((t, i) => {
          const Icon = INFO_ICON_MAP[t.icon];
          const accent = ACCENT_BY_ICON[t.icon]?.accent ?? "#3b82f6";
          return (
            <div key={i} className="border rounded-lg p-3 flex items-start gap-2">
              {Icon && <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: accent }} />}
              <div>
                <p className="text-xs font-semibold">{t.title}</p>
                <p className="text-xs text-muted-foreground">{t.subtitle}</p>
              </div>
            </div>
          );
        })}
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
      {guaranteeTiles.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t">
          {guaranteeTiles.map((t) => {
            const Icon = INFO_ICON_MAP[t.icon];
            const accent = ACCENT_BY_ICON[t.icon]?.accent ?? "#3b82f6";
            return (
              <div key={t.label} className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: accent }} />}
                <span className="text-xs text-muted-foreground">{t.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

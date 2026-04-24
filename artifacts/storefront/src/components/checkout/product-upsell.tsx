import { useEffect, useState, useMemo } from "react";
import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Offer {
  id: number;
  name: string;
  imageUrl: string | null;
  variantId: number;
  variantName: string;
  priceUsd: string;
  platform: string | null;
}

interface ConfiguredUpsell {
  productId: number;
  displayPrice: string | null;
  strikethroughPrice: string | null;
  urgencyMessage: string | null;
  checkboxLabel: string | null;
  productName: string;
  productSlug: string;
  productImage: string | null;
  variantId: number;
  variantName: string;
  variantPrice: string;
  platform: string | null;
}

export function ProductUpsell() {
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const { format } = useCurrencyStore();
  const { toast } = useToast();
  const [configured, setConfigured] = useState<ConfiguredUpsell | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);

  const cartProductIds = items.map((i) => i.productId);
  const cartSignature = useMemo(
    () => items.map((i) => `${i.productId}:${i.quantity}`).join("|"),
    [items],
  );

  useEffect(() => {
    let cancelled = false;
    const excludeIds = cartProductIds.join(",");

    (async () => {
      try {
        const uRes = await fetch(`${API}/checkout/upsell`, { cache: "no-store" });
        const uData = await uRes.json();
        const u = uData.upsell as ConfiguredUpsell | null | undefined;
        if (!cancelled && u && !cartProductIds.includes(u.productId)) {
          setConfigured(u);
          setOffers([]);
          return;
        }
        if (!cancelled) setConfigured(null);
      } catch {
        if (!cancelled) setConfigured(null);
      }

      if (cancelled) return;

      try {
        const oRes = await fetch(`${API}/checkout/offers?exclude=${excludeIds}`);
        const data = await oRes.json();
        if (cancelled) return;
        if (data.offers?.length > 0) {
          setOffers(data.offers);
        } else {
          const fallback = MOCK_PRODUCTS.filter(
            (p) => p.isFeatured && !cartProductIds.includes(p.id),
          )
            .slice(0, 2)
            .map((p) => ({
              id: p.id,
              name: p.name,
              imageUrl: p.imageUrl,
              variantId: p.variants[0].id,
              variantName: p.variants[0].name,
              priceUsd: p.variants[0].priceUsd,
              platform: p.variants[0].platform,
            }));
          setOffers(fallback);
        }
      } catch {
        if (cancelled) return;
        const fallback = MOCK_PRODUCTS.filter(
          (p) => p.isFeatured && !cartProductIds.includes(p.id),
        )
          .slice(0, 2)
          .map((p) => ({
            id: p.id,
            name: p.name,
            imageUrl: p.imageUrl,
            variantId: p.variants[0].id,
            variantName: p.variants[0].name,
            priceUsd: p.variants[0].priceUsd,
            platform: p.variants[0].platform,
          }));
        setOffers(fallback);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cartSignature]);

  if (configured) {
    const priceStr =
      configured.displayPrice != null && String(configured.displayPrice).trim() !== ""
        ? String(configured.displayPrice)
        : configured.variantPrice;
    const strikeStr =
      configured.strikethroughPrice != null && String(configured.strikethroughPrice).trim() !== ""
        ? String(configured.strikethroughPrice)
        : null;
    const btnLabel = configured.checkboxLabel?.trim() || "Add";

    return (
      <div className="border rounded-lg p-3 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 dark:from-amber-950/30 dark:to-orange-950/20 dark:border-amber-800 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-300">Special offer</h3>
          {configured.urgencyMessage ? (
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">{configured.urgencyMessage}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded bg-card border flex items-center justify-center shrink-0 overflow-hidden">
            {configured.productImage ? (
              <img src={configured.productImage} alt="" className="w-full h-full object-contain" />
            ) : (
              <Package className="h-5 w-5 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate leading-tight">{configured.productName}</p>
            <div className="flex items-baseline gap-2 mt-0.5 text-xs">
              <span className="text-muted-foreground truncate">{configured.variantName}</span>
              <span className="text-sm font-bold text-foreground">{format(parseFloat(priceStr))}</span>
              {strikeStr ? (
                <span className="text-muted-foreground line-through">{format(parseFloat(strikeStr))}</span>
              ) : null}
            </div>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs shrink-0"
            onClick={() => {
              addItem({
                variantId: configured.variantId,
                productId: configured.productId,
                productName: configured.productName,
                variantName: configured.variantName,
                imageUrl: configured.productImage,
                priceUsd: priceStr,
                platform: configured.platform ?? undefined,
              });
              toast({ title: `${configured.productName} added to cart` });
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            {btnLabel}
          </Button>
        </div>
      </div>
    );
  }

  if (offers.length === 0) return null;

  return (
    <div className="border rounded-lg p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 dark:from-amber-950/30 dark:to-orange-950/20 dark:border-amber-800 shadow-sm">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-300 mb-3">Complete your order</h3>
      <div className="space-y-2">
        {offers.map((o) => (
          <div key={o.variantId} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-card border flex items-center justify-center shrink-0">
              {o.imageUrl ? (
                <img src={o.imageUrl} alt="" className="w-full h-full object-contain rounded" />
              ) : (
                <Package className="h-4 w-4 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{o.name}</p>
              <p className="text-xs text-muted-foreground">{format(parseFloat(o.priceUsd))}</p>
            </div>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                addItem({
                  variantId: o.variantId,
                  productId: o.id,
                  productName: o.name,
                  variantName: o.variantName,
                  imageUrl: o.imageUrl,
                  priceUsd: o.priceUsd,
                  platform: o.platform ?? undefined,
                });
                toast({ title: `${o.name} added to order` });
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

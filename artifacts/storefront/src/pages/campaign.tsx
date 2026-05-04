import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Clock, Loader2, Tag } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface CampaignProduct {
  id: number; name: string; slug: string; imageUrl: string | null; description: string | null;
  variants: { id: number; name: string; priceUsd: string; stockCount: number | null }[];
}
interface Campaign {
  id: number; slug: string; headline: string; subtext: string | null;
  heroImageUrl: string | null; heroBgColor: string | null;
  endsAt: string | null; couponCode: string | null;
}

function Countdown({ endsAt }: { endsAt: string }) {
  const calc = () => {
    const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { h, m, s, expired: diff === 0 };
  };
  const [t, setT] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (t.expired) return <p className="text-white/70 text-sm">This offer has ended.</p>;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4 text-white/70" />
      <span className="text-white/80 text-sm">Ends in</span>
      {[{ label: "h", val: t.h }, { label: "m", val: t.m }, { label: "s", val: t.s }].map(({ label, val }) => (
        <div key={label} className="text-center">
          <div className="bg-white/20 rounded px-2 py-1 font-mono font-bold text-white text-lg leading-none">{pad(val)}</div>
          <div className="text-white/50 text-[10px] mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

function ProductCard({ product, campaignCoupon }: { product: CampaignProduct; campaignCoupon: string | null }) {
  const { format } = useCurrencyStore();
  const addItem = useCartStore((s) => s.addItem);
  const { toast } = useToast();
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);

  if (!selectedVariant) return null;
  const inStock = (selectedVariant.stockCount ?? 1) > 0;

  const handleAdd = () => {
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: product.name,
      variantName: selectedVariant.name,
      priceUsd: selectedVariant.priceUsd,
      imageUrl: product.imageUrl,
    });
    toast({ title: "Added to cart", description: `${product.name}${campaignCoupon ? ` · Coupon ${campaignCoupon} active` : ""}` });
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
      <Link href={`/product/${product.slug}`}>
        <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
          {product.imageUrl
            ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform" loading="lazy" />
            : <ShoppingCart className="h-12 w-12 text-muted-foreground/30" />}
        </div>
      </Link>
      <div className="p-4 flex flex-col flex-1 gap-3">
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-semibold text-sm leading-snug hover:text-primary transition-colors line-clamp-2">{product.name}</h3>
        </Link>
        {product.variants.length > 1 && (
          <select className="text-xs border rounded px-2 py-1 bg-background w-full"
            value={selectedVariant.id} onChange={(e) => setSelectedVariant(product.variants.find((v) => v.id === Number(e.target.value))!)}>
            {product.variants.map((v) => <option key={v.id} value={v.id}>{v.name} — {format(parseFloat(v.priceUsd))}</option>)}
          </select>
        )}
        <div className="flex items-center justify-between mt-auto">
          <span className="text-lg font-bold text-primary">{format(parseFloat(selectedVariant.priceUsd))}</span>
          <Button size="sm" onClick={handleAdd} disabled={!inStock} className="gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" />
            {inStock ? "Add" : "Out of stock"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CampaignPage() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const setCoupon = useCartStore((s) => s.setCoupon);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [products, setProducts] = useState<CampaignProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const applyCoupon = useCallback(async (code: string) => {
    try {
      const r = await fetch(`${API}/coupons/validate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (r.ok) {
        const d = await r.json();
        if (d.valid) {
          setCoupon({ code: d.code, pct: d.discount, label: d.label, productIds: d.productIds ?? null });
          toast({ title: `Coupon ${d.code} applied!`, description: d.label });
        }
      }
    } catch { /* silent */ }
  }, [setCoupon, toast]);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API}/campaigns/${slug}`)
      .then((r) => { if (!r.ok) { setNotFound(true); return null; } return r.json(); })
      .then((d) => {
        if (!d) return;
        setCampaign(d.campaign);
        setProducts(d.products ?? []);
        // Write campaign UTM into attribution (override session)
        try {
          sessionStorage.setItem("px_attr", JSON.stringify({ utm_source: "campaign", utm_campaign: d.campaign.slug }));
        } catch { /* blocked */ }
        if (d.campaign.couponCode) applyCoupon(d.campaign.couponCode);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (notFound || !campaign) return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center space-y-4">
      <h1 className="text-2xl font-bold">Campaign Not Found</h1>
      <p className="text-muted-foreground">This campaign may have ended or the link is incorrect.</p>
      <Link href="/shop"><Button>Browse Products</Button></Link>
    </div>
  );

  const bgStyle = campaign.heroImageUrl
    ? { backgroundImage: `url(${campaign.heroImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundColor: campaign.heroBgColor ?? "#0f172a" };

  return (
    <div>
      {/* Hero */}
      <div style={bgStyle} className="relative">
        {campaign.heroImageUrl && <div className="absolute inset-0 bg-black/50" />}
        <div className="relative container mx-auto px-4 py-16 md:py-24 text-center space-y-6">
          {campaign.couponCode && (
            <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 rounded-full px-4 py-1.5">
              <Tag className="h-3.5 w-3.5 text-white" />
              <span className="text-white text-sm font-medium">Code {campaign.couponCode} auto-applied</span>
            </div>
          )}
          <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">{campaign.headline}</h1>
          {campaign.subtext && <p className="text-lg text-white/80 max-w-2xl mx-auto">{campaign.subtext}</p>}
          {campaign.endsAt && <Countdown endsAt={campaign.endsAt} />}
          <Link href="#products">
            <Button size="lg" className="mt-2 bg-white text-foreground hover:bg-white/90 font-semibold">
              Shop the Deal
            </Button>
          </Link>
        </div>
      </div>

      {/* Products */}
      <div id="products" className="container mx-auto px-4 py-12">
        {products.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No products in this campaign yet.</p>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-6">Featured Products</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.map((p) => <ProductCard key={p.id} product={p} campaignCoupon={campaign.couponCode} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

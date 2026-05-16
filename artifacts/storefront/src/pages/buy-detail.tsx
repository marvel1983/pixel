import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Loader2, ShoppingCart, ShieldCheck, Zap, Check, ChevronRight } from "lucide-react";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { Separator } from "@/components/ui/separator";
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";
import { useCurrencyStore } from "@/stores/currency-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface BuyData {
  product: {
    name: string; slug: string; imageUrl: string | null;
    avgRating: string | null; reviewCount: number;
    categorySlug: string | null; categoryName: string | null;
    fromPrice: string | null;
  };
  seo: {
    intro: string;
    whyBuy: string[];
    faq: { q: string; a: string }[];
    activationSteps: string[];
  } | null;
}

export default function BuyDetailPage() {
  const params = useParams<{ slug: string }>();
  const [data, setData] = useState<BuyData | null>(null);
  const [loading, setLoading] = useState(true);
  const format = useCurrencyStore((s) => s.format);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/products/${params.slug}/buy`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: BuyData) => {
        setData(d);
        setSeoMeta({
          title: `Buy ${d.product.name} — Cheapest Genuine Key, Instant Delivery | PixelCodes`,
          description: d.seo ? d.seo.intro.slice(0, 300) : `Buy ${d.product.name} — genuine key, instant email delivery, lifetime activation.`,
          canonicalUrl: `${window.location.origin}/buy/${d.product.slug}`,
          ogImage: d.product.imageUrl ?? undefined,
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    return clearSeoMeta;
  }, [params.slug]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Product Not Found</h1>
        <Link href="/shop" className="text-primary hover:underline">Browse the shop →</Link>
      </div>
    );
  }

  const { product: p, seo } = data;
  const productHref = `/product/${p.slug}`;
  const crumbs = [
    { label: "Shop", href: "/shop" },
    ...(p.categorySlug ? [{ label: p.categoryName ?? p.categorySlug, href: `/category/${p.categorySlug}` }] : []),
    { label: `Buy ${p.name}` },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      <Breadcrumbs crumbs={crumbs} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">Buy {p.name}</h1>
          {seo?.intro && <p className="text-base text-muted-foreground leading-relaxed">{seo.intro}</p>}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Zap className="h-4 w-4 text-primary" /> Instant email delivery</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Genuine licence</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> Lifetime activation</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:sticky lg:top-4 space-y-3">
          {p.imageUrl && (
            <img src={p.imageUrl} alt={p.name} className="w-full h-40 object-contain rounded-lg bg-white" loading="lazy" />
          )}
          {p.fromPrice && (
            <div>
              <div className="text-xs text-muted-foreground">From</div>
              <div className="text-3xl font-extrabold tabular-nums">{format(parseFloat(p.fromPrice))}</div>
            </div>
          )}
          {Number(p.reviewCount) > 0 && (
            <div className="text-sm text-muted-foreground">
              ★ {Number(p.avgRating ?? 0).toFixed(1)} · {p.reviewCount} verified reviews
            </div>
          )}
          <Link
            href={productHref}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
          >
            <ShoppingCart className="h-5 w-5" /> Buy {p.name}
          </Link>
          <p className="text-[11px] text-center text-muted-foreground">Secure checkout · Genuine keys · 24/7 support</p>
        </div>
      </div>

      {seo && (
        <>
          <Separator />
          <section className="space-y-3">
            <h2 className="text-xl font-bold">Why buy {p.name} from PixelCodes</h2>
            <ul className="space-y-2">
              {seo.whyBuy.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </section>

          {seo.activationSteps.length > 0 && (
            <>
              <Separator />
              <section className="space-y-3">
                <h2 className="text-xl font-bold">How to activate {p.name}</h2>
                <ol className="space-y-2 list-decimal list-inside text-sm text-muted-foreground">
                  {seo.activationSteps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </section>
            </>
          )}

          {seo.faq.length > 0 && (
            <>
              <Separator />
              <section className="space-y-4">
                <h2 className="text-xl font-bold">{p.name} — Frequently asked questions</h2>
                <div className="space-y-4">
                  {seo.faq.map((f, i) => (
                    <div key={i}>
                      <h3 className="font-semibold text-sm mb-1">{f.q}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}

      <Separator />
      <Link href={productHref} className="inline-flex items-center gap-1 text-primary font-medium hover:underline">
        See full {p.name} details and reviews <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

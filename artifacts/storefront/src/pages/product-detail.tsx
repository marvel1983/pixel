import { useEffect, useState } from "react";
import { useParams } from "wouter";
import type { MockProduct, MockVariant } from "@/lib/mock-data";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { ProductImage } from "@/components/product-detail/product-image";
import { ProductMeta } from "@/components/product-detail/product-meta";
import { ProductPurchaseCard } from "@/components/product-detail/product-purchase-card";
import { BundleHero } from "@/components/product-detail/bundle-hero";
import { CrossSell } from "@/components/product-detail/cross-sell";
import { TrustBadges } from "@/components/product-detail/trust-badges";
import { SocialShare } from "@/components/product-detail/social-share";
import { ProductTabs } from "@/components/product-detail/product-tabs";
import { ReviewsSection } from "@/components/product-detail/reviews-section";
import { QASection } from "@/components/product-detail/qa-section";
import { RelatedProducts } from "@/components/product-detail/related-products";
import { PaymentIcons } from "@/components/product-detail/payment-icons";
import { TrustpilotBadge } from "@/components/trustpilot/trustpilot-badge";
import { BundleCrossSell } from "@/components/product-detail/bundle-cross-sell";
import { addToRecentlyViewed } from "@/components/home/recently-viewed";
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";
import { ProductJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { Separator } from "@/components/ui/separator";
import { toMockProduct } from "@/lib/use-products";
import { ProductDetailSkeleton } from "@/components/product-detail/product-detail-skeleton";

const API = import.meta.env.VITE_API_URL ?? "/api";

const CATEGORY_NAMES: Record<string, string> = {
  "operating-systems": "Operating Systems",
  "office-productivity": "Office & Productivity",
  "antivirus-security": "Antivirus & Security",
  games: "Games",
  "servers-development": "Servers & Development",
};

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";

  const [product, setProduct] = useState<MockProduct | null | undefined>(undefined);
  const [fetchError, setFetchError] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<MockProduct[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<MockVariant | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setProduct(undefined);
    setFetchError(false);
    setRelatedProducts([]);
    fetch(`${API}/products/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (r.status === 404) { setProduct(null); return; }
        if (!r.ok) { setFetchError(true); return; }
        const data = await r.json();
        const p = toMockProduct(data);
        setProduct(p);
        setSelectedVariant(p.variants[0] ?? null);
        if (p.categorySlug) {
          fetch(`${API}/products?cat=${encodeURIComponent(p.categorySlug)}&limit=6&stock=1`)
            .then((r) => (r.ok ? r.json() : null))
            .then((res) => {
              if (res?.items) {
                setRelatedProducts(
                  res.items.map(toMockProduct).filter((r: MockProduct) => r.id !== data.id),
                );
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => setFetchError(true));
  }, [slug]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    if (product) {
      addToRecentlyViewed(product.id);
      const price = product.variants[0]?.priceUsd ?? "0";
      setSeoMeta({
        title: `${product.name} | PixelCodes`,
        description: `Buy ${product.name} for $${price}. Instant digital delivery. Genuine license key with lifetime validity. ${product.reviewCount} reviews, ${product.avgRating}/5 rating.`,
        canonicalUrl: `${window.location.origin}/product/${product.slug}`,
        ogImage: product.imageUrl ?? undefined,
      });
    }
    return () => { clearSeoMeta(); };
  }, [product]);

  if (product === undefined && !fetchError) {
    return <ProductDetailSkeleton />;
  }

  if (fetchError) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-muted-foreground mb-4">Could not load this product. Please try again.</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-white rounded-md text-sm">Reload page</button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
        <p className="text-muted-foreground">The product you're looking for doesn't exist.</p>
      </div>
    );
  }

  // Bundle anchors don't have own variants — skip variant requirement
  if (!product.bundle && !selectedVariant) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
        <p className="text-muted-foreground">The product you're looking for doesn't exist.</p>
      </div>
    );
  }

  const categoryName = CATEGORY_NAMES[product.categorySlug] ?? product.categorySlug;

  const breadcrumbs = [
    { label: "Shop", href: "/shop" },
    { label: categoryName, href: `/category/${product.categorySlug}` },
    { label: product.name },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      <ProductJsonLd product={product} />
      <BreadcrumbJsonLd items={breadcrumbs} />
      <Breadcrumbs crumbs={breadcrumbs} />

      {product.bundle ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
          <ProductImage imageUrl={product.imageUrl} productName={product.name} additionalImages={product.additionalImages} />
          <BundleHero product={product} bundle={product.bundle} />
        </div>
      ) : selectedVariant ? (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr_300px] lg:items-start">
          <ProductImage imageUrl={product.imageUrl} productName={product.name} additionalImages={product.additionalImages} />
          <ProductMeta product={product} selectedVariant={selectedVariant} onVariantChange={setSelectedVariant} />
          <ProductPurchaseCard product={product} selectedVariant={selectedVariant} quantity={quantity} onQuantityChange={setQuantity} />
        </div>
      ) : null}

      <SocialShare productName={product.name} />
      <Separator />
      <BundleCrossSell productId={product.id} />
      <CrossSell currentProduct={product} relatedProducts={relatedProducts} />
      <TrustpilotBadge variant="compact" />
      <TrustBadges />
      <PaymentIcons />

      <ProductTabs
        productName={product.name}
        platform={product.variants[0]?.platform ?? "WINDOWS"}
        description={product.description}
        keyFeatures={product.keyFeatures}
        systemRequirements={product.systemRequirements}
        productAttributes={product.productAttributes}
      />

      <Separator />
      <ReviewsSection productId={product.id} avgRating={product.avgRating} reviewCount={product.reviewCount} />
      <Separator />
      <QASection productId={product.id} />
      <Separator />
      <RelatedProducts products={relatedProducts} />
    </div>
  );
}

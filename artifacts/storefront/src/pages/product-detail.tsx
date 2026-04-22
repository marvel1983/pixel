import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { MOCK_PRODUCTS, type MockProduct, type MockVariant } from "@/lib/mock-data";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { ProductImage } from "@/components/product-detail/product-image";
import { ProductMeta } from "@/components/product-detail/product-meta";
import { ProductPurchaseCard } from "@/components/product-detail/product-purchase-card";
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

  const mockProduct = useMemo(
    () => MOCK_PRODUCTS.find((p) => p.slug === slug),
    [slug],
  );

  const [apiProduct, setApiProduct] = useState<MockProduct | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    if (mockProduct) {
      setApiProduct(null);
      return;
    }
    setApiProduct(undefined);
    fetch(`${API}/products/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setApiProduct(data ?? null))
      .catch(() => setApiProduct(null));
  }, [slug, mockProduct]);

  const product: MockProduct | undefined = mockProduct ?? (apiProduct ?? undefined);

  const [selectedVariant, setSelectedVariant] = useState<MockVariant | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (product?.variants[0]) {
      setSelectedVariant(product.variants[0]);
    }
  }, [product]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return MOCK_PRODUCTS.filter(
      (p) => p.categorySlug === product.categorySlug && p.id !== product.id,
    );
  }, [product]);

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
    return () => {
      clearSeoMeta();
    };
  }, [product]);

  if (!mockProduct && apiProduct === undefined) {
    return <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Loading…</div>;
  }

  if (!product || !selectedVariant) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
        <p className="text-muted-foreground">
          The product you're looking for doesn't exist.
        </p>
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

      {/* 3-column grid: image | meta | purchase card */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr_300px] lg:items-start">
        <ProductImage imageUrl={product.imageUrl} productName={product.name} />

        <ProductMeta
          product={product}
          selectedVariant={selectedVariant}
          onVariantChange={setSelectedVariant}
        />

        <ProductPurchaseCard
          product={product}
          selectedVariant={selectedVariant}
          quantity={quantity}
          onQuantityChange={setQuantity}
        />
      </div>

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
      />

      <Separator />

      <ReviewsSection
        productId={product.id}
        avgRating={product.avgRating}
        reviewCount={product.reviewCount}
      />

      <Separator />

      <QASection productId={product.id} />

      <Separator />

      <RelatedProducts products={relatedProducts} />
    </div>
  );
}

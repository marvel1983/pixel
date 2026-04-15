import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { MOCK_PRODUCTS, type MockProduct } from "@/lib/mock-data";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { ProductImage } from "@/components/product-detail/product-image";
import { ProductInfo } from "@/components/product-detail/product-info";
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
      // Mock products don't need an API call
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

  // Still loading API response
  if (!mockProduct && apiProduct === undefined) {
    return <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Loading…</div>;
  }

  if (!product) {
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

      <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
        <ProductImage imageUrl={product.imageUrl} productName={product.name} />

        <div className="space-y-5 lg:px-8">
          <ProductInfo product={product} />
          <SocialShare productName={product.name} />
          <Separator />
          <BundleCrossSell productId={product.id} />
          <CrossSell
            currentProduct={product}
            relatedProducts={relatedProducts}
          />
          <TrustpilotBadge variant="compact" />
          <TrustBadges />
          <PaymentIcons />
        </div>
      </div>

      <ProductTabs
        productName={product.name}
        platform={product.variants[0]?.platform ?? "WINDOWS"}
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

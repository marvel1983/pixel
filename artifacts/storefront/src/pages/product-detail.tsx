import { useEffect, useMemo } from "react";
import { useParams } from "wouter";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
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
import { BundleCrossSell } from "@/components/product-detail/bundle-cross-sell";
import { addToRecentlyViewed } from "@/components/home/recently-viewed";
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";
import { Separator } from "@/components/ui/separator";

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

  const product = useMemo(
    () => MOCK_PRODUCTS.find((p) => p.slug === slug),
    [slug],
  );

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return MOCK_PRODUCTS.filter(
      (p) => p.categorySlug === product.categorySlug && p.id !== product.id,
    );
  }, [product]);

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

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <Breadcrumbs
        crumbs={[
          { label: "Shop", href: "/shop" },
          { label: categoryName, href: `/category/${product.categorySlug}` },
          { label: product.name },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductImage imageUrl={product.imageUrl} productName={product.name} />

        <div className="space-y-5">
          <ProductInfo product={product} />
          <SocialShare productName={product.name} />
          <Separator />
          <BundleCrossSell productId={product.id} />
          <CrossSell
            currentProduct={product}
            relatedProducts={relatedProducts}
          />
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

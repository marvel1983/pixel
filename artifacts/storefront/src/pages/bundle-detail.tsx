import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Loader2 } from "lucide-react";
import { ProductImage } from "@/components/product-detail/product-image";
import { BundleHero } from "@/components/product-detail/bundle-hero";
import { ProductTabs } from "@/components/product-detail/product-tabs";
import { ReviewsSection } from "@/components/product-detail/reviews-section";
import { QASection } from "@/components/product-detail/qa-section";
import { SocialShare } from "@/components/product-detail/social-share";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { Separator } from "@/components/ui/separator";
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";
import type { MockProduct, PublicBundle } from "@/lib/mock-data";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface BundleAnchor {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  galleryImages: string[] | null;
  description: string | null;
  shortDescription: string | null;
  regionRestrictions: string[] | null;
  avgRating: string | null;
  reviewCount: number;
  keyFeatures: string[] | null;
  systemRequirements: Record<string, string> | null;
  platformType: string | null;
}

interface BundleDetailResponse {
  bundle: {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    shortDescription: string | null;
    imageUrl: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    public: PublicBundle | null;
  };
  anchor: BundleAnchor | null;
}

export default function BundleDetailPage() {
  const params = useParams<{ slug: string }>();
  const [data, setData] = useState<BundleDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/bundles/${params.slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: BundleDetailResponse) => {
        setData(d);
        setSeoMeta({
          title: d.bundle.metaTitle || `${d.bundle.name} | PixelCodes`,
          description: d.bundle.metaDescription || d.bundle.shortDescription || "",
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
  const publicBundle = data?.bundle.public ?? null;
  if (!data || !data.anchor || !publicBundle) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Bundle Not Found</h1>
      </div>
    );
  }

  const anchor = data.anchor;
  const bundle = data.bundle;

  const productForHero: MockProduct = {
    id: anchor.id,
    name: bundle.name || anchor.name,
    slug: anchor.slug,
    imageUrl: bundle.imageUrl ?? anchor.imageUrl,
    additionalImages: anchor.galleryImages ?? [],
    categorySlug: "",
    avgRating: 0,
    reviewCount: 0,
    variants: [],
    isFeatured: false,
    isNew: false,
    regionRestrictions: anchor.regionRestrictions ?? [],
  };

  const breadcrumbs = [
    { label: "Bundles", href: "/bundles" },
    { label: bundle.name },
  ];

  // Description shown in the tabs: bundle's own copy takes precedence, fall
  // back to the anchor product's description so the bundle isn't blank.
  const description = bundle.description || anchor.description || "";
  const platform = publicBundle?.components[0]?.platform ?? anchor.platformType ?? "WINDOWS";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      <Breadcrumbs crumbs={breadcrumbs} />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
        <ProductImage
          imageUrl={productForHero.imageUrl}
          productName={productForHero.name}
          additionalImages={productForHero.additionalImages}
        />
        <BundleHero product={productForHero} bundle={publicBundle} />
      </div>

      <SocialShare productName={bundle.name} />
      <Separator />

      <ProductTabs
        productName={bundle.name}
        platform={platform}
        description={description}
        keyFeatures={anchor.keyFeatures ?? []}
        systemRequirements={anchor.systemRequirements ?? {}}
      />

      <Separator />
      {/* Reviews and Q&A are scoped to the anchor product — the bundle is sold
          around that product, so its reputation is what customers care about. */}
      <ReviewsSection
        productId={anchor.id}
        avgRating={parseFloat(anchor.avgRating ?? "0")}
        reviewCount={anchor.reviewCount}
      />
      <Separator />
      <QASection productId={anchor.id} />
    </div>
  );
}

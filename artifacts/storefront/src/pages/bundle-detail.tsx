import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Loader2 } from "lucide-react";
import { ProductImage } from "@/components/product-detail/product-image";
import { BundleHero } from "@/components/product-detail/bundle-hero";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
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
  if (!data || !data.anchor || !data.bundle.public) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Bundle Not Found</h1>
      </div>
    );
  }

  // BundleHero expects a MockProduct-shaped object — the only fields it reads
  // are name, regionRestrictions, and indirectly via `product.name` for the
  // cart toast. The bundle name takes precedence over the anchor's name so the
  // hero heading matches what the admin titled the bundle.
  const productForHero: MockProduct = {
    id: data.anchor.id,
    name: data.bundle.name || data.anchor.name,
    slug: data.anchor.slug,
    imageUrl: data.bundle.imageUrl ?? data.anchor.imageUrl,
    additionalImages: data.anchor.galleryImages ?? [],
    categorySlug: "",
    avgRating: 0,
    reviewCount: 0,
    variants: [],
    isFeatured: false,
    isNew: false,
    regionRestrictions: data.anchor.regionRestrictions ?? [],
  };

  const breadcrumbs = [
    { label: "Bundles", href: "/bundles" },
    { label: data.bundle.name },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      <Breadcrumbs crumbs={breadcrumbs} />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
        <ProductImage
          imageUrl={productForHero.imageUrl}
          productName={productForHero.name}
          additionalImages={productForHero.additionalImages}
        />
        <BundleHero product={productForHero} bundle={data.bundle.public} />
      </div>
    </div>
  );
}

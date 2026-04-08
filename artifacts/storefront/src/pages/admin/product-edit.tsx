import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Save, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { ProductEditSidebar } from "@/components/admin/product-edit-sidebar";
import { ProductEditContent } from "@/components/admin/product-edit-content";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export interface ProductData {
  id: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  type: string;
  categoryId: number | null;
  imageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  keyFeatures: string[];
  systemRequirements: Record<string, string>;
  relatedProductIds: number[];
  crossSellProductIds: number[];
  regionRestrictions: string[];
  platformType: string | null;
}

export interface VariantData {
  id: number;
  name: string;
  sku: string;
  platform: string | null;
  priceUsd: string;
  compareAtPriceUsd: string | null;
  priceOverrideUsd: string | null;
  stockCount: number;
  isActive: boolean;
}

export interface CategoryOption { id: number; name: string; }
export interface ProductOption { id: number; name: string; }

export default function ProductEditPage() {
  const [, params] = useRoute("/admin/products/:id");
  const [, setLocation] = useLocation();
  const token = useAuthStore((s) => s.token) ?? "";
  const [product, setProduct] = useState<ProductData | null>(null);
  const [variants, setVariants] = useState<VariantData[]>([]);
  const [cats, setCats] = useState<CategoryOption[]>([]);
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const productId = params?.id;

  useEffect(() => {
    if (!productId) return;
    fetch(`${API_URL}/admin/products/${productId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setProduct({
          ...d.product,
          keyFeatures: d.product.keyFeatures ?? [],
          systemRequirements: d.product.systemRequirements ?? {},
          relatedProductIds: d.product.relatedProductIds ?? [],
          crossSellProductIds: d.product.crossSellProductIds ?? [],
        });
        setVariants(d.variants);
        setCats(d.categories);
        setAllProducts(d.allProducts ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId, token]);

  const updateField = <K extends keyof ProductData>(key: K, value: ProductData[K]) => {
    setProduct((prev) => prev ? { ...prev, [key]: value } : prev);
    setSaved(false);
  };

  const handleVariantUpdate = (variantId: number, override: string | null) => {
    setVariants((prev) => prev.map((v) => v.id === variantId ? { ...v, priceOverrideUsd: override } : v));
  };

  const handleSave = async () => {
    if (!product) return;
    setSaving(true);
    const res = await fetch(`${API_URL}/admin/products/${product.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4"><Skeleton className="h-[400px]" /></div>
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  if (!product) {
    return <div className="p-12 text-center text-muted-foreground">Product not found.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={() => setLocation("/admin/products")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold truncate">{product.name}</h1>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <ProductEditContent
            product={product}
            variants={variants}
            allProducts={allProducts}
            token={token}
            onUpdate={updateField}
            onVariantUpdate={handleVariantUpdate}
          />
        </div>
        <ProductEditSidebar
          product={product}
          categories={cats}
          allProducts={allProducts}
          onUpdate={updateField}
        />
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Save, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { ProductEditSidebar } from "@/components/admin/product-edit-sidebar";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface ProductData {
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
}

interface VariantData {
  id: number;
  name: string;
  sku: string;
  platform: string | null;
  priceUsd: string;
  compareAtPriceUsd: string | null;
  stockCount: number;
  isActive: boolean;
}

interface CategoryOption {
  id: number;
  name: string;
}

export default function ProductEditPage() {
  const [, params] = useRoute("/admin/products/:id");
  const [, setLocation] = useLocation();
  const token = useAuthStore((s) => s.token);
  const [product, setProduct] = useState<ProductData | null>(null);
  const [variants, setVariants] = useState<VariantData[]>([]);
  const [cats, setCats] = useState<CategoryOption[]>([]);
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
        setProduct(d.product);
        setVariants(d.variants);
        setCats(d.categories);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId, token]);

  const updateField = <K extends keyof ProductData>(key: K, value: ProductData[K]) => {
    setProduct((prev) => prev ? { ...prev, [key]: value } : prev);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!product) return;
    setSaving(true);
    const res = await fetch(`${API_URL}/admin/products/${product.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
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
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-[400px]" />
          </div>
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
          <div className="rounded-lg border bg-white p-6 space-y-4">
            <h2 className="font-semibold">Content</h2>
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={product.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Slug</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={product.slug}
                onChange={(e) => updateField("slug", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Short Description</label>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={2}
                value={product.shortDescription ?? ""}
                onChange={(e) => updateField("shortDescription", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm font-mono"
                rows={8}
                value={product.description ?? ""}
                onChange={(e) => updateField("description", e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 space-y-4">
            <h2 className="font-semibold">SEO</h2>
            <div>
              <label className="mb-1 block text-sm font-medium">Meta Title</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={product.metaTitle ?? ""}
                onChange={(e) => updateField("metaTitle", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Meta Description</label>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={3}
                value={product.metaDescription ?? ""}
                onChange={(e) => updateField("metaDescription", e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 space-y-3">
            <h2 className="font-semibold">Variants (Read-only from Metenzi)</h2>
            {variants.length === 0 ? (
              <p className="text-muted-foreground text-sm">No variants.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-4 font-medium text-muted-foreground">SKU</th>
                      <th className="py-2 pr-4 font-medium text-muted-foreground">Name</th>
                      <th className="py-2 pr-4 font-medium text-muted-foreground">Platform</th>
                      <th className="py-2 pr-4 font-medium text-muted-foreground">Price</th>
                      <th className="py-2 font-medium text-muted-foreground">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => (
                      <tr key={v.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs">{v.sku}</td>
                        <td className="py-2 pr-4">{v.name}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{v.platform ?? "—"}</td>
                        <td className="py-2 pr-4 font-medium">${v.priceUsd}</td>
                        <td className="py-2">{v.stockCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <ProductEditSidebar
          product={product}
          categories={cats}
          onUpdate={updateField}
        />
      </div>
    </div>
  );
}

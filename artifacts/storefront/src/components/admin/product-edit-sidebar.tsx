import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { ProductData, CategoryOption, ProductOption } from "@/pages/admin/product-edit";

interface ProductEditSidebarProps {
  product: ProductData;
  categories: CategoryOption[];
  allProducts: ProductOption[];
  onUpdate: <K extends keyof ProductData>(key: K, value: ProductData[K]) => void;
}

export function ProductEditSidebar({ product, categories, allProducts, onUpdate }: ProductEditSidebarProps) {
  const toggleRelated = (id: number) => {
    const ids = product.relatedProductIds.includes(id)
      ? product.relatedProductIds.filter((x) => x !== id)
      : [...product.relatedProductIds, id];
    onUpdate("relatedProductIds", ids);
  };

  const toggleCrossSell = (id: number) => {
    const ids = product.crossSellProductIds.includes(id)
      ? product.crossSellProductIds.filter((x) => x !== id)
      : [...product.crossSellProductIds, id];
    onUpdate("crossSellProductIds", ids);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="font-semibold">Status</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm">Active</span>
          <Switch checked={product.isActive} onCheckedChange={(v) => onUpdate("isActive", v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Featured</span>
          <Switch checked={product.isFeatured} onCheckedChange={(v) => onUpdate("isFeatured", v)} />
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="font-semibold">Organization</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">Category</label>
          <select className="w-full rounded-md border px-3 py-2 text-sm" value={product.categoryId ?? ""}
            onChange={(e) => onUpdate("categoryId", e.target.value ? Number(e.target.value) : null)}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Product Type</label>
          <select className="w-full rounded-md border px-3 py-2 text-sm" value={product.type}
            onChange={(e) => onUpdate("type", e.target.value)}>
            <option value="SOFTWARE">Software</option>
            <option value="GAME">Game</option>
            <option value="SUBSCRIPTION">Subscription</option>
            <option value="DLC">DLC</option>
            <option value="GIFT_CARD">Gift Card</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Sort Order</label>
          <input type="number" className="w-full rounded-md border px-3 py-2 text-sm"
            value={product.sortOrder} onChange={(e) => onUpdate("sortOrder", Number(e.target.value))} />
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="font-semibold">Image</h2>
        {product.imageUrl ? (
          <div className="rounded-md overflow-hidden border">
            <img src={product.imageUrl} alt={product.name} className="w-full h-auto" />
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-md border-2 border-dashed text-muted-foreground text-sm">
            No image
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">Image URL</label>
          <input className="w-full rounded-md border px-3 py-2 text-sm" value={product.imageUrl ?? ""}
            onChange={(e) => onUpdate("imageUrl", e.target.value || null)} placeholder="https://..." />
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-3">
        <h2 className="font-semibold">Related Products</h2>
        <div className="flex flex-wrap gap-1.5">
          {product.relatedProductIds.map((id) => {
            const rp = allProducts.find((p) => p.id === id);
            return rp ? (
              <Badge key={id} variant="secondary" className="gap-1 text-xs">
                {rp.name}
                <button onClick={() => toggleRelated(id)}><X className="h-3 w-3" /></button>
              </Badge>
            ) : null;
          })}
        </div>
        <select className="w-full rounded-md border px-3 py-2 text-sm" value=""
          onChange={(e) => e.target.value && toggleRelated(Number(e.target.value))}>
          <option value="">Add related product...</option>
          {allProducts.filter((p) => !product.relatedProductIds.includes(p.id)).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-3">
        <h2 className="font-semibold">Cross-sells</h2>
        <p className="text-xs text-muted-foreground">Shown at checkout and in cart</p>
        <div className="flex flex-wrap gap-1.5">
          {product.crossSellProductIds.map((id) => {
            const rp = allProducts.find((p) => p.id === id);
            return rp ? (
              <Badge key={id} variant="secondary" className="gap-1 text-xs">
                {rp.name}
                <button onClick={() => toggleCrossSell(id)}><X className="h-3 w-3" /></button>
              </Badge>
            ) : null;
          })}
        </div>
        <select className="w-full rounded-md border px-3 py-2 text-sm" value=""
          onChange={(e) => e.target.value && toggleCrossSell(Number(e.target.value))}>
          <option value="">Add cross-sell product...</option>
          {allProducts.filter((p) => !product.crossSellProductIds.includes(p.id)).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

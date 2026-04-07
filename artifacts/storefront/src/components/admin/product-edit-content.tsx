import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProductData, VariantData, ProductOption } from "@/pages/admin/product-edit";

interface Props {
  product: ProductData;
  variants: VariantData[];
  allProducts: ProductOption[];
  onUpdate: <K extends keyof ProductData>(key: K, value: ProductData[K]) => void;
}

export function ProductEditContent({ product, variants, allProducts, onUpdate }: Props) {
  const [newFeature, setNewFeature] = useState("");
  const [newReqKey, setNewReqKey] = useState("");
  const [newReqVal, setNewReqVal] = useState("");

  const addFeature = () => {
    if (!newFeature.trim()) return;
    onUpdate("keyFeatures", [...product.keyFeatures, newFeature.trim()]);
    setNewFeature("");
  };

  const removeFeature = (idx: number) => {
    onUpdate("keyFeatures", product.keyFeatures.filter((_, i) => i !== idx));
  };

  const addReq = () => {
    if (!newReqKey.trim() || !newReqVal.trim()) return;
    onUpdate("systemRequirements", { ...product.systemRequirements, [newReqKey.trim()]: newReqVal.trim() });
    setNewReqKey("");
    setNewReqVal("");
  };

  const removeReq = (key: string) => {
    const copy = { ...product.systemRequirements };
    delete copy[key];
    onUpdate("systemRequirements", copy);
  };

  const toggleRelated = (id: number) => {
    const ids = product.relatedProductIds.includes(id)
      ? product.relatedProductIds.filter((x) => x !== id)
      : [...product.relatedProductIds, id];
    onUpdate("relatedProductIds", ids);
  };

  return (
    <>
      <div className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="font-semibold">Content</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input className="w-full rounded-md border px-3 py-2 text-sm" value={product.name}
            onChange={(e) => onUpdate("name", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Slug</label>
          <input className="w-full rounded-md border px-3 py-2 text-sm" value={product.slug}
            onChange={(e) => onUpdate("slug", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Short Description</label>
          <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={2}
            value={product.shortDescription ?? ""} onChange={(e) => onUpdate("shortDescription", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description (Markdown supported)</label>
          <textarea className="w-full rounded-md border px-3 py-2 text-sm font-mono" rows={8}
            value={product.description ?? ""} onChange={(e) => onUpdate("description", e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="font-semibold">Key Features</h2>
        <div className="flex flex-wrap gap-2">
          {product.keyFeatures.map((f, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              {f}
              <button onClick={() => removeFeature(i)}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="flex-1 rounded-md border px-3 py-2 text-sm" placeholder="Add a feature..."
            value={newFeature} onChange={(e) => setNewFeature(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())} />
          <Button size="sm" variant="outline" onClick={addFeature}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="font-semibold">System Requirements</h2>
        {Object.entries(product.systemRequirements).length > 0 && (
          <div className="space-y-2">
            {Object.entries(product.systemRequirements).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-sm">
                <span className="font-medium min-w-[100px]">{k}:</span>
                <span className="flex-1 text-muted-foreground">{v}</span>
                <button onClick={() => removeReq(k)} className="text-red-500 hover:text-red-700"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input className="w-32 rounded-md border px-3 py-2 text-sm" placeholder="e.g. OS"
            value={newReqKey} onChange={(e) => setNewReqKey(e.target.value)} />
          <input className="flex-1 rounded-md border px-3 py-2 text-sm" placeholder="e.g. Windows 10+"
            value={newReqVal} onChange={(e) => setNewReqVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addReq())} />
          <Button size="sm" variant="outline" onClick={addReq}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="font-semibold">Pricing &amp; Variants (Synced from Metenzi)</h2>
        <p className="text-xs text-muted-foreground">Prices and stock are managed via Metenzi and cannot be overridden here.</p>
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
                  <th className="py-2 pr-4 font-medium text-muted-foreground">Compare At</th>
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
                    <td className="py-2 pr-4 text-muted-foreground">
                      {v.compareAtPriceUsd ? <span className="line-through">${v.compareAtPriceUsd}</span> : "—"}
                    </td>
                    <td className="py-2">{v.stockCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="font-semibold">SEO</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">Meta Title</label>
          <input className="w-full rounded-md border px-3 py-2 text-sm" value={product.metaTitle ?? ""}
            onChange={(e) => onUpdate("metaTitle", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Meta Description</label>
          <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={3}
            value={product.metaDescription ?? ""} onChange={(e) => onUpdate("metaDescription", e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="font-semibold">Related Products / Cross-sells</h2>
        <div className="flex flex-wrap gap-2 mb-2">
          {product.relatedProductIds.map((id) => {
            const rp = allProducts.find((p) => p.id === id);
            return rp ? (
              <Badge key={id} variant="secondary" className="gap-1">
                {rp.name}
                <button onClick={() => toggleRelated(id)}><X className="h-3 w-3" /></button>
              </Badge>
            ) : null;
          })}
        </div>
        <select className="w-full rounded-md border px-3 py-2 text-sm"
          value="" onChange={(e) => e.target.value && toggleRelated(Number(e.target.value))}>
          <option value="">Add related product...</option>
          {allProducts.filter((p) => !product.relatedProductIds.includes(p.id)).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    </>
  );
}

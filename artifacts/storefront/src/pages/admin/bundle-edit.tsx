import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  emptyBundle, toFormState,
  type BundleFormState, type AdminBundle, type ProductOption, type PricingPreview,
} from "./bundle-types";
import { BundleEditForm } from "./bundle-edit-form";
import { BundleEditPreview } from "./bundle-edit-preview";
import { BundleProductPicker } from "./bundle-product-picker";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function BundleEditPage() {
  const [, params] = useRoute("/admin/bundles/:id/edit");
  const [isNewRoute] = useRoute("/admin/bundles/new");
  const [, setLocation] = useLocation();
  const token = useAuthStore((s) => s.token) ?? "";
  const { toast } = useToast();
  const isNew = Boolean(isNewRoute);
  const bundleId = isNew ? null : params?.id ? parseInt(params.id) : null;

  const [form, setForm] = useState<BundleFormState>(emptyBundle());
  /** Component product IDs only — anchor (primaryProductId) is NEVER here. */
  const [componentIds, setComponentIds] = useState<number[]>([]);
  const [freeIds, setFreeIds] = useState<Set<number>>(new Set());
  const [productCache, setProductCache] = useState<Map<number, ProductOption>>(new Map());
  const [pricing, setPricing] = useState<PricingPreview | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [anchorPickerOpen, setAnchorPickerOpen] = useState(false);
  const [companionPickerOpen, setCompanionPickerOpen] = useState(false);

  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    if (isNew || !bundleId) return;
    setLoading(true);
    (async () => {
      const r = await fetch(`${API}/admin/bundles/${bundleId}`, { headers: h });
      if (!r.ok) { toast({ title: "Bundle not found", variant: "destructive" }); setLocation("/admin/bundles"); return; }
      const b = (await r.json()) as AdminBundle;
      setForm(toFormState(b));
      setComponentIds(b.items.map((it) => it.productId));
      setFreeIds(new Set(b.items.filter((it) => it.isFree).map((it) => it.productId)));
      const cache = new Map<number, ProductOption>(b.items.map((it) => [
        it.productId,
        { id: it.productId, name: it.productName, imageUrl: it.productImage, priceUsd: it.productPrice ?? null },
      ]));
      // Anchor product is not in items — fetch it separately if we have one.
      // (The list endpoint doesn't filter by id, so use the single-product route.)
      if (b.primaryProductId) {
        const ar = await fetch(`${API}/admin/products/${b.primaryProductId}`, { headers: h });
        if (ar.ok) {
          const anchor = await ar.json();
          if (anchor && anchor.id) {
            cache.set(anchor.id, { id: anchor.id, name: anchor.name, imageUrl: anchor.imageUrl, priceUsd: null });
          }
        }
      }
      setProductCache(cache);
      setLoading(false);
    })();
  }, [bundleId, isNew]);

  // Live pricing preview
  useEffect(() => {
    if (componentIds.length < 1 || !form.primaryProductId) { setPricing(null); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`${API}/admin/bundles/preview`, {
        method: "POST", headers: h,
        body: JSON.stringify({
          primaryProductId: form.primaryProductId,
          productIds: componentIds,
          freeProductIds: Array.from(freeIds).filter((id) => componentIds.includes(id)),
          discountType: form.discountType, discountValue: form.discountValue || "0",
        }),
      });
      if (r.ok) {
        const data = await r.json();
        setPricing({ sumOriginalUsd: data.sumOriginalUsd, finalUsd: data.finalUsd, savingsUsd: data.savingsUsd });
      }
    }, 200);
    return () => clearTimeout(t);
  }, [componentIds, freeIds, form.primaryProductId, form.discountType, form.discountValue, token]);

  function pickAnchor(prod: ProductOption) {
    setProductCache((prev) => new Map(prev).set(prod.id, prod));
    setForm((f) => ({ ...f, primaryProductId: prod.id }));
    // If anchor was previously a component, remove from components
    setComponentIds((prev) => prev.filter((id) => id !== prod.id));
    setFreeIds((prev) => {
      const next = new Set(prev);
      next.delete(prod.id);
      return next;
    });
  }

  function addCompanions(prods: ProductOption[]) {
    setProductCache((prev) => {
      const next = new Map(prev);
      for (const p of prods) next.set(p.id, p);
      return next;
    });
    setComponentIds((prev) => {
      const set = new Set(prev);
      for (const p of prods) if (p.id !== form.primaryProductId) set.add(p.id);
      return Array.from(set);
    });
  }

  function moveCompanion(idx: number, dir: -1 | 1) {
    setComponentIds((prev) => {
      const arr = [...prev];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return prev;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }

  function removeCompanion(id: number) {
    setComponentIds((prev) => prev.filter((x) => x !== id));
    setFreeIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleFree(id: number) {
    setFreeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save(action: "draft" | "publish") {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (!form.slug.trim()) { toast({ title: "Slug is required", variant: "destructive" }); return; }
    if (!form.primaryProductId) { toast({ title: "Pick an anchor product", variant: "destructive" }); return; }
    if (componentIds.length < 1) { toast({ title: "Add at least one component product", variant: "destructive" }); return; }
    if (form.discountType === "BUY_X_GET_Y_FREE" && freeIds.size === 0) {
      toast({ title: "Mark at least one component as free", variant: "destructive" });
      return;
    }

    setSaving(true);
    const body = {
      ...form,
      isActive: action === "publish" ? true : form.isActive,
      productIds: componentIds,
      freeProductIds: Array.from(freeIds).filter((id) => componentIds.includes(id)),
      discountValue: form.discountValue || "0",
    };
    const url = form.id ? `${API}/admin/bundles/${form.id}` : `${API}/admin/bundles`;
    const r = await fetch(url, { method: form.id ? "PUT" : "POST", headers: h, body: JSON.stringify(body) });
    setSaving(false);
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      toast({ title: err.error ?? "Save failed", variant: "destructive" });
      return;
    }
    const saved = await r.json();
    toast({ title: form.id ? "Bundle updated" : "Bundle created" });
    if (!form.id) setLocation(`/admin/bundles/${saved.id}/edit`);
    else setForm((f) => ({ ...f, id: saved.id }));
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-[1fr_400px] gap-5">
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-[#0c1018]/95 backdrop-blur border-b border-[#2a2e3a] flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/bundles")} className="gap-1.5 text-[#8fa0bb] hover:text-[#dde4f0]">
          <ArrowLeft className="h-4 w-4" /> Bundles
        </Button>
        <div className="text-[#5a6a84]">/</div>
        <h1 className="text-base font-semibold text-[#dde4f0] truncate">
          {isNew ? "New bundle" : form.name || "Edit bundle"}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => save("draft")} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save draft
          </Button>
          <Button size="sm" onClick={() => save("publish")} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {form.isActive ? "Update & publish" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5">
        <BundleEditForm
          form={form}
          setForm={setForm}
          componentIds={componentIds}
          freeIds={freeIds}
          productCache={productCache}
          onToggleFree={toggleFree}
          onMoveCompanion={moveCompanion}
          onRemoveCompanion={removeCompanion}
          onPickAnchor={() => setAnchorPickerOpen(true)}
          onAddCompanions={() => setCompanionPickerOpen(true)}
        />
        <BundleEditPreview form={form} componentIds={componentIds} freeIds={freeIds} productCache={productCache} pricing={pricing} />
      </div>

      <BundleProductPicker
        open={anchorPickerOpen} onClose={() => setAnchorPickerOpen(false)}
        mode="single" title="Pick the bundle product (anchor)"
        excludedIds={componentIds}
        onConfirmSingle={pickAnchor}
      />
      <BundleProductPicker
        open={companionPickerOpen} onClose={() => setCompanionPickerOpen(false)}
        mode="multi" title="Add components to this bundle"
        excludedIds={[...componentIds, ...(form.primaryProductId ? [form.primaryProductId] : [])]}
        onConfirmMulti={addCompanions}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Save, ArrowLeft, Plus, X, Trash2, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export interface ProductData {
  id: number; name: string; slug: string;
  shortDescription: string | null; description: string | null;
  type: string; categoryId: number | null; imageUrl: string | null;
  metaTitle: string | null; metaDescription: string | null;
  isFeatured: boolean; isActive: boolean; sortOrder: number;
  keyFeatures: string[]; systemRequirements: Record<string, string>;
  relatedProductIds: number[]; crossSellProductIds: number[];
  regionRestrictions: string[]; platformType: string | null;
}

interface TagDef { id: number; name: string; slug: string; colorHex: string | null; }
interface AttrOptionDef { id: number; value: string; slug: string; colorHex: string | null; }
interface AttrDef { id: number; name: string; slug: string; type: "SELECT" | "TEXT" | "BOOLEAN" | "NUMBER"; unit: string | null; isVisibleOnPdp: boolean; options: AttrOptionDef[]; }
interface AttrValue { optionId: number | null; valueText: string | null; valueNumber: string | null; }

export interface VariantData {
  id: number; name: string; sku: string; platform: string | null;
  priceUsd: string; compareAtPriceUsd: string | null;
  priceOverrideUsd: string | null;
  costPriceUsd: string | null;
  b2bPriceUsd: string | null;
  stockCount: number; isActive: boolean;
}

export interface CategoryOption { id: number; name: string; }
export interface ProductOption { id: number; name: string; }

const REGION_OPTIONS = ["EU", "NA", "LATAM", "ASIA", "RU", "UK"];
const PLATFORM_OPTIONS = ["STEAM", "ORIGIN", "UPLAY", "GOG", "EPIC", "BATTLENET", "MICROSOFT", "XBOX", "PLAYSTATION", "NINTENDO"];

const inp: React.CSSProperties = {
  width: "100%", background: "#0f1117", border: "1px solid #1f2330",
  borderRadius: 4, padding: "4px 8px", fontSize: 12, color: "#c8d0e0",
  outline: "none", boxSizing: "border-box",
};
const secTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "#566070", textTransform: "uppercase",
  letterSpacing: "0.07em", marginBottom: 8,
};
const lbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: "#566070", textTransform: "uppercase",
  letterSpacing: "0.05em", marginBottom: 3, display: "block",
};
const card: React.CSSProperties = {
  background: "#1a1d28", border: "1px solid #252836", borderRadius: 6, padding: "10px 12px",
};
const tag: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 3,
  background: "#1e2a4a", color: "#93c5fd", borderRadius: 3, padding: "2px 6px", fontSize: 10,
};
const iconBtn: React.CSSProperties = {
  background: "#1e2a4a", border: "1px solid #2a3a5a", color: "#60a5fa",
  borderRadius: 4, padding: "4px 7px", cursor: "pointer", display: "flex", alignItems: "center",
};

function VariantPricingCard({
  variant,
  onUpdate,
  onDelete,
}: {
  variant: VariantData;
  onUpdate: (id: number, patch: Partial<VariantData>) => void;
  onDelete: (id: number) => void;
}) {
  const cost = parseFloat(variant.costPriceUsd ?? "") || 0;
  const selling = parseFloat(variant.priceUsd) || 0;
  const salePrice = parseFloat(variant.priceOverrideUsd ?? "") || 0;

  const derivedMarginPct = selling > 0 ? ((selling - cost) / selling * 100) : 0;
  const derivedMarginAmt = selling - cost;
  const saleDiscount = selling > 0 && salePrice > 0 && salePrice < selling
    ? Math.round((1 - salePrice / selling) * 100) : 0;

  function set(key: keyof VariantData, val: string | number | boolean | null) {
    onUpdate(variant.id, { [key]: val });
  }

  function handleMarginPctBlur(e: React.FocusEvent<HTMLInputElement>) {
    const pct = parseFloat(e.target.value);
    if (!isNaN(pct) && pct > 0 && pct < 100 && cost > 0) {
      const newSelling = (cost / (1 - pct / 100)).toFixed(2);
      onUpdate(variant.id, { priceUsd: newSelling });
    }
    e.target.value = selling > 0 ? derivedMarginPct.toFixed(2) : "";
  }

  function handleMarginAmtBlur(e: React.FocusEvent<HTMLInputElement>) {
    const amt = parseFloat(e.target.value);
    if (!isNaN(amt) && cost >= 0) {
      const newSelling = Math.max(0, cost + amt).toFixed(2);
      onUpdate(variant.id, { priceUsd: newSelling });
    }
    e.target.value = selling > 0 ? derivedMarginAmt.toFixed(2) : "";
  }

  const fieldCard: React.CSSProperties = {
    display: "flex", flexDirection: "column", gap: 3, flex: 1,
  };
  const fieldLabel: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, color: "#566070", textTransform: "uppercase",
    letterSpacing: "0.06em",
  };
  const numInp: React.CSSProperties = {
    width: "100%", background: "#0f1117", border: "1px solid #1f2330",
    borderRadius: 4, padding: "5px 8px", fontSize: 12, color: "#c8d0e0",
    outline: "none", boxSizing: "border-box" as const,
  };
  const derivedInp: React.CSSProperties = {
    ...numInp, border: "1px solid #2a3a5a", background: "#0d1520", color: "#60a5fa",
  };

  return (
    <div style={{ border: "1px solid #252836", borderRadius: 6, overflow: "hidden" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#13161e", borderBottom: "1px solid #252836" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#c8d0e0", flex: 1 }}>{variant.name}</span>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "#566070" }}>{variant.sku}</span>
        <span style={{
          fontSize: 9, borderRadius: 3, padding: "1px 6px", cursor: "pointer",
          background: variant.isActive ? "#0a2015" : "#1f2330",
          color: variant.isActive ? "#4ade80" : "#566070",
          border: `1px solid ${variant.isActive ? "#166534" : "#252836"}`,
        }} onClick={() => set("isActive", !variant.isActive)}>
          {variant.isActive ? "Active" : "Inactive"}
        </span>
        <button onClick={() => onDelete(variant.id)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#3a4255", display: "flex", padding: 2 }}
          title="Delete variant">
          <Trash2 size={12} />
        </button>
      </div>

      {/* Pricing grid */}
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>

        {/* Row 1: Cost | Selling | Margin % | Margin $ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
          <div style={fieldCard}>
            <span style={fieldLabel}>Cost Price</span>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#566070" }}>$</span>
              <input
                type="number"
                style={{ ...numInp, paddingLeft: 18, border: "1px solid #1f2a3a" }}
                placeholder="0.00"
                value={variant.costPriceUsd ?? ""}
                onChange={(e) => set("costPriceUsd", e.target.value || null)}
              />
            </div>
          </div>

          <div style={fieldCard}>
            <span style={fieldLabel}>Selling Price</span>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#566070" }}>$</span>
              <input
                type="number"
                style={{ ...numInp, paddingLeft: 18, border: "1px solid #1e3a8a" }}
                placeholder="0.00"
                value={variant.priceUsd}
                onChange={(e) => set("priceUsd", e.target.value)}
              />
            </div>
          </div>

          <div style={fieldCard}>
            <span style={{ ...fieldLabel, color: "#4a6a9a" }}>Margin %</span>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                style={{ ...derivedInp, paddingRight: 22 }}
                placeholder="—"
                defaultValue={selling > 0 && cost >= 0 ? derivedMarginPct.toFixed(2) : ""}
                key={`mpct-${variant.id}-${variant.priceUsd}-${variant.costPriceUsd}`}
                onBlur={handleMarginPctBlur}
                title="Edit to change selling price"
              />
              <span style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#4a6a9a" }}>%</span>
            </div>
          </div>

          <div style={fieldCard}>
            <span style={{ ...fieldLabel, color: "#4a6a9a" }}>Margin $</span>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#4a6a9a" }}>$</span>
              <input
                type="number"
                style={{ ...derivedInp, paddingLeft: 18 }}
                placeholder="—"
                defaultValue={selling > 0 && cost >= 0 ? derivedMarginAmt.toFixed(2) : ""}
                key={`mamt-${variant.id}-${variant.priceUsd}-${variant.costPriceUsd}`}
                onBlur={handleMarginAmtBlur}
                title="Edit to change selling price"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Compare At | Sale Price | B2B | Stock */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 0.7fr", gap: 8 }}>
          <div style={fieldCard}>
            <span style={fieldLabel}>Compare At</span>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#566070" }}>$</span>
              <input
                type="number"
                style={{ ...numInp, paddingLeft: 18 }}
                placeholder="0.00"
                value={variant.compareAtPriceUsd ?? ""}
                onChange={(e) => set("compareAtPriceUsd", e.target.value || null)}
              />
            </div>
          </div>

          <div style={fieldCard}>
            <span style={fieldLabel}>
              Sale Price
              {saleDiscount > 0 && (
                <span style={{ marginLeft: 5, color: "#f87171", fontSize: 9 }}>-{saleDiscount}% off</span>
              )}
            </span>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#566070" }}>$</span>
              <input
                type="number"
                style={{ ...numInp, paddingLeft: 18, border: salePrice > 0 ? "1px solid #7f1d1d" : "1px solid #1f2330", background: salePrice > 0 ? "#1a0a0a" : "#0f1117" }}
                placeholder="0.00 (empty = none)"
                value={variant.priceOverrideUsd ?? ""}
                onChange={(e) => set("priceOverrideUsd", e.target.value || null)}
              />
            </div>
          </div>

          <div style={fieldCard}>
            <span style={fieldLabel}>B2B Price</span>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#566070" }}>$</span>
              <input
                type="number"
                style={{ ...numInp, paddingLeft: 18 }}
                placeholder="0.00 (optional)"
                value={variant.b2bPriceUsd ?? ""}
                onChange={(e) => set("b2bPriceUsd", e.target.value || null)}
              />
            </div>
          </div>

          <div style={fieldCard}>
            <span style={fieldLabel}>Stock</span>
            <input
              type="number"
              style={{ ...numInp, color: variant.stockCount === 0 ? "#f87171" : variant.stockCount < 5 ? "#fbbf24" : "#c8d0e0" }}
              value={variant.stockCount}
              onChange={(e) => set("stockCount", Number(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [newFeature, setNewFeature] = useState("");
  const [newReqKey, setNewReqKey] = useState("");
  const [newReqVal, setNewReqVal] = useState("");
  // new variant form
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [newV, setNewV] = useState({ name: "", sku: "", priceUsd: "", compareAtPriceUsd: "", stockCount: "0" });
  const [addingVariant, setAddingVariant] = useState(false);
  const [addVariantError, setAddVariantError] = useState("");
  const [variantDrafts, setVariantDrafts] = useState<Map<number, Partial<VariantData>>>(new Map());
  // Tags
  const [allTags, setAllTags] = useState<TagDef[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  // Attributes
  const [allAttributeDefs, setAllAttributeDefs] = useState<AttrDef[]>([]);
  const [attributeValues, setAttributeValues] = useState<Map<number, AttrValue>>(new Map());

  function patchVariant(id: number, patch: Partial<VariantData>) {
    setVariantDrafts((prev) => {
      const next = new Map(prev);
      next.set(id, { ...(next.get(id) ?? {}), ...patch });
      return next;
    });
    setVariants((vs) => vs.map((v) => v.id === id ? { ...v, ...patch } : v));
    setSaved(false);
  }

  const productId = params?.id;

  useEffect(() => {
    if (!productId) return;
    const authHdr = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_URL}/admin/products/${productId}`, { headers: authHdr }).then((r) => r.json()),
      fetch(`${API_URL}/admin/tags`, { headers: authHdr }).then((r) => r.json()).catch(() => []),
      fetch(`${API_URL}/admin/products/${productId}/tags`, { headers: authHdr }).then((r) => r.json()).catch(() => []),
      fetch(`${API_URL}/admin/attributes`, { headers: authHdr }).then((r) => r.json()).catch(() => []),
      fetch(`${API_URL}/admin/products/${productId}/attributes`, { headers: authHdr }).then((r) => r.json()).catch(() => []),
    ]).then(async ([d, tagsData, productTagsData, attrsData, productAttrsData]) => {
      setProduct({ ...d.product, keyFeatures: d.product.keyFeatures ?? [], systemRequirements: d.product.systemRequirements ?? {}, relatedProductIds: d.product.relatedProductIds ?? [], crossSellProductIds: d.product.crossSellProductIds ?? [] });
      setVariants(d.variants); setCats(d.categories); setAllProducts(d.allProducts ?? []);

      // Tags
      const tagsArr: TagDef[] = Array.isArray(tagsData) ? tagsData : tagsData.tags ?? [];
      setAllTags(tagsArr);
      const tagIds: number[] = Array.isArray(productTagsData) ? productTagsData : productTagsData.tagIds ?? [];
      setSelectedTagIds(tagIds);

      // Attributes
      const defsArr: Array<{ id: number; name: string; slug: string; type: string; unit: string | null; isVisibleOnPdp: boolean }> = Array.isArray(attrsData) ? attrsData : attrsData.attributes ?? [];
      const selectDefs = defsArr.filter((a) => a.type === "SELECT");
      const optionsMap = new Map<number, AttrOptionDef[]>();
      await Promise.all(selectDefs.map(async (def) => {
        const opts = await fetch(`${API_URL}/admin/attributes/${def.id}/options`, { headers: authHdr })
          .then((r) => r.json()).catch(() => []);
        const optsArr: AttrOptionDef[] = Array.isArray(opts) ? opts : opts.options ?? [];
        optionsMap.set(def.id, optsArr);
      }));
      const fullDefs: AttrDef[] = defsArr.map((def) => ({
        ...def,
        type: def.type as AttrDef["type"],
        options: optionsMap.get(def.id) ?? [],
      }));
      setAllAttributeDefs(fullDefs);

      // Product attribute values
      const prodAttrsArr = Array.isArray(productAttrsData) ? productAttrsData : productAttrsData.attributes ?? [];
      const valMap = new Map<number, AttrValue>();
      for (const pa of prodAttrsArr) {
        valMap.set(pa.attributeId, {
          optionId: pa.optionId ?? null,
          valueText: pa.valueText ?? null,
          valueNumber: pa.valueNumber ?? null,
        });
      }
      setAttributeValues(valMap);
    })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId, token]);

  const upd = <K extends keyof ProductData>(key: K, value: ProductData[K]) => {
    setProduct((p) => p ? { ...p, [key]: value } : p);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!product) return;
    setSaving(true);
    const res = await fetch(`${API_URL}/admin/products/${product.id}`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });

    // Save all dirty variant drafts
    if (variantDrafts.size > 0) {
      await Promise.all(
        Array.from(variantDrafts.entries()).map(([variantId, patch]) =>
          fetch(`${API_URL}/admin/variants/${variantId}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          })
        )
      );
      setVariantDrafts(new Map());
    }

    // Save tags
    await fetch(`${API_URL}/admin/products/${product.id}/tags`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds: selectedTagIds }),
    }).catch(() => {});

    // Save attributes
    await fetch(`${API_URL}/admin/products/${product.id}/attributes`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        attributes: Array.from(attributeValues.entries()).map(([attributeId, v]) => ({ attributeId, ...v })),
      }),
    }).catch(() => {});

    setSaving(false);
    if (res.ok) setSaved(true);
  };

  const handleAddVariant = async () => {
    if (!product) return;
    if (!newV.name.trim() || !newV.sku.trim() || !newV.priceUsd) { setAddVariantError("Name, SKU and Price are required"); return; }
    setAddingVariant(true); setAddVariantError("");
    const res = await fetch(`${API_URL}/admin/products/${product.id}/variants`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: newV.name.trim(), sku: newV.sku.trim(), priceUsd: newV.priceUsd, compareAtPriceUsd: newV.compareAtPriceUsd || undefined, stockCount: Number(newV.stockCount) || 0 }),
    });
    setAddingVariant(false);
    if (res.ok) {
      const data = await res.json();
      setVariants((v) => [...v, data.variant]);
      setNewV({ name: "", sku: "", priceUsd: "", compareAtPriceUsd: "", stockCount: "0" });
      setShowAddVariant(false);
    } else {
      const err = await res.json().catch(() => ({}));
      setAddVariantError(err.error || "Failed to add variant");
    }
  };

  const handleDeleteVariant = async (variantId: number) => {
    await fetch(`${API_URL}/admin/variants/${variantId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    setVariants((v) => v.filter((x) => x.id !== variantId));
  };

  if (loading) return <div style={{ height: 300, ...card }} />;
  if (!product) return <div style={{ padding: 40, textAlign: "center", color: "#566070" }}>Product not found.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%", overflow: "hidden" }}>

      {/* ── Topbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button onClick={() => setLocation("/admin/products")}
          style={{ ...card, padding: "4px 7px", color: "#8b94a8", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}>
          <ArrowLeft size={13} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {product.name}
        </span>
        <span style={{ fontSize: 10, borderRadius: 3, padding: "2px 7px", background: product.isActive ? "#0a2015" : "#1f2330", color: product.isActive ? "#4ade80" : "#566070", border: `1px solid ${product.isActive ? "#166534" : "#252836"}`, flexShrink: 0 }}>
          {product.isActive ? "Active" : "Inactive"}
        </span>
        <button onClick={handleSave} disabled={saving}
          style={{ display: "flex", alignItems: "center", gap: 5, background: saved ? "#0a2015" : "#1e3a8a", border: `1px solid ${saved ? "#166534" : "#2563eb"}`, color: saved ? "#4ade80" : "#93c5fd", borderRadius: 4, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", flexShrink: 0 }}>
          <Save size={12} />
          {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {/* ── Body: left content + right sidebar ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 210px", gap: 8, flex: 1, minHeight: 0 }}>

        {/* ── LEFT — scrollable ── */}
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>

          {/* Basic info */}
          <div style={card}>
            <p style={secTitle}>Basic Info</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
              <div><label style={lbl}>Name</label><input style={inp} value={product.name} onChange={(e) => upd("name", e.target.value)} /></div>
              <div><label style={lbl}>Slug</label><input style={inp} value={product.slug} onChange={(e) => upd("slug", e.target.value)} /></div>
            </div>
            <div>
              <label style={lbl}>Short Description</label>
              <textarea style={{ ...inp, resize: "none", height: 42 }} value={product.shortDescription ?? ""} onChange={(e) => upd("shortDescription", e.target.value)} />
            </div>
          </div>

          {/* Description */}
          <div style={card}>
            <p style={secTitle}>Description</p>
            <RichTextEditor content={product.description ?? ""} onChange={(html) => upd("description", html)} placeholder="Write product description…" />
          </div>

          {/* Pricing & Variants */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ ...secTitle, marginBottom: 0 }}>Pricing &amp; Variants</p>
              <button onClick={() => { setShowAddVariant((v) => !v); setAddVariantError(""); }}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "#1e3a8a", border: "1px solid #2563eb", color: "#93c5fd", borderRadius: 4, padding: "3px 9px", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                <Plus size={11} /> Add Variant
              </button>
            </div>

            {/* Add variant inline form */}
            {showAddVariant && (
              <div style={{ background: "#13161e", border: "1px solid #252836", borderRadius: 5, padding: "8px 10px", marginBottom: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px 90px 70px", gap: 6 }}>
                  <div><label style={lbl}>Variant Name</label><input style={inp} placeholder="e.g. Standard Key" value={newV.name} onChange={(e) => setNewV((v) => ({ ...v, name: e.target.value }))} /></div>
                  <div><label style={lbl}>SKU</label><input style={inp} placeholder="e.g. MS-OFF-2024" value={newV.sku} onChange={(e) => setNewV((v) => ({ ...v, sku: e.target.value }))} /></div>
                  <div><label style={lbl}>Price (USD)</label><input style={inp} type="number" placeholder="0.00" value={newV.priceUsd} onChange={(e) => setNewV((v) => ({ ...v, priceUsd: e.target.value }))} /></div>
                  <div><label style={lbl}>Compare At</label><input style={inp} type="number" placeholder="0.00" value={newV.compareAtPriceUsd} onChange={(e) => setNewV((v) => ({ ...v, compareAtPriceUsd: e.target.value }))} /></div>
                  <div><label style={lbl}>Stock</label><input style={inp} type="number" placeholder="0" value={newV.stockCount} onChange={(e) => setNewV((v) => ({ ...v, stockCount: e.target.value }))} /></div>
                </div>
                {addVariantError && <p style={{ fontSize: 10, color: "#f87171", margin: 0 }}>{addVariantError}</p>}
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => { setShowAddVariant(false); setAddVariantError(""); }} style={{ background: "none", border: "1px solid #252836", color: "#8b94a8", borderRadius: 4, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                  <button onClick={handleAddVariant} disabled={addingVariant}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: "#0a2015", border: "1px solid #166534", color: "#4ade80", borderRadius: 4, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: addingVariant ? "not-allowed" : "pointer", opacity: addingVariant ? 0.6 : 1 }}>
                    <Check size={11} /> {addingVariant ? "Saving…" : "Save Variant"}
                  </button>
                </div>
              </div>
            )}

            {variants.length === 0 ? (
              <p style={{ fontSize: 11, color: "#566070" }}>No variants yet. Click "Add Variant" to create one.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {variants.map((v) => (
                  <VariantPricingCard
                    key={v.id}
                    variant={v}
                    onUpdate={patchVariant}
                    onDelete={handleDeleteVariant}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Key Features */}
          <div style={card}>
            <p style={secTitle}>Key Features</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
              {product.keyFeatures.map((f, i) => (
                <span key={i} style={tag}>{f}
                  <button onClick={() => upd("keyFeatures", product.keyFeatures.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#60a5fa", padding: 0, display: "flex" }}><X size={9} /></button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <input style={{ ...inp, flex: 1 }} placeholder="Add feature and press Enter…" value={newFeature} onChange={(e) => setNewFeature(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newFeature.trim()) { e.preventDefault(); upd("keyFeatures", [...product.keyFeatures, newFeature.trim()]); setNewFeature(""); } }} />
              <button style={iconBtn} onClick={() => { if (newFeature.trim()) { upd("keyFeatures", [...product.keyFeatures, newFeature.trim()]); setNewFeature(""); } }}><Plus size={13} /></button>
            </div>
          </div>

          {/* System Requirements */}
          <div style={card}>
            <p style={secTitle}>System Requirements</p>
            {Object.entries(product.systemRequirements).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
                {Object.entries(product.systemRequirements).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                    <span style={{ color: "#8b94a8", minWidth: 90, fontWeight: 600 }}>{k}</span>
                    <span style={{ flex: 1, color: "#c8d0e0" }}>{v}</span>
                    <button onClick={() => { const c = { ...product.systemRequirements }; delete c[k]; upd("systemRequirements", c); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#3a4255", display: "flex" }}><X size={11} /></button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 5 }}>
              <input style={{ ...inp, width: 100, flex: "none" }} placeholder="e.g. OS" value={newReqKey} onChange={(e) => setNewReqKey(e.target.value)} />
              <input style={{ ...inp, flex: 1 }} placeholder="e.g. Windows 10+" value={newReqVal} onChange={(e) => setNewReqVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newReqKey.trim() && newReqVal.trim()) { e.preventDefault(); upd("systemRequirements", { ...product.systemRequirements, [newReqKey.trim()]: newReqVal.trim() }); setNewReqKey(""); setNewReqVal(""); } }} />
              <button style={iconBtn} onClick={() => { if (newReqKey.trim() && newReqVal.trim()) { upd("systemRequirements", { ...product.systemRequirements, [newReqKey.trim()]: newReqVal.trim() }); setNewReqKey(""); setNewReqVal(""); } }}><Plus size={13} /></button>
            </div>
          </div>

          {/* Tags */}
          <div style={card}>
            <p style={secTitle}>Tags</p>
            {/* Selected tags as colored badges */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
              {selectedTagIds.map((tid) => {
                const t = allTags.find((x) => x.id === tid);
                if (!t) return null;
                return (
                  <span key={tid} style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    background: t.colorHex ?? "#3b82f6", color: "#fff",
                    borderRadius: 3, padding: "2px 6px", fontSize: 10, fontWeight: 600,
                  }}>
                    {t.name}
                    <button
                      onClick={() => setSelectedTagIds((ids) => ids.filter((x) => x !== tid))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 0, display: "flex" }}
                    ><X size={9} /></button>
                  </span>
                );
              })}
              {selectedTagIds.length === 0 && (
                <span style={{ fontSize: 11, color: "#566070" }}>No tags assigned.</span>
              )}
            </div>
            {/* Dropdown to add a tag */}
            <select
              style={inp}
              value=""
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val && !selectedTagIds.includes(val)) {
                  setSelectedTagIds((ids) => [...ids, val]);
                  setSaved(false);
                }
              }}
            >
              <option value="">Add tag…</option>
              {allTags.filter((t) => !selectedTagIds.includes(t.id)).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Attributes */}
          <div style={card}>
            <p style={secTitle}>Attributes</p>
            {allAttributeDefs.length === 0 ? (
              <p style={{ fontSize: 11, color: "#566070" }}>No attribute definitions configured.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {allAttributeDefs.map((def) => {
                  const val = attributeValues.get(def.id) ?? { optionId: null, valueText: null, valueNumber: null };
                  const setVal = (patch: Partial<AttrValue>) => {
                    setAttributeValues((prev) => {
                      const next = new Map(prev);
                      next.set(def.id, { ...val, ...patch });
                      return next;
                    });
                    setSaved(false);
                  };
                  return (
                    <div key={def.id}>
                      <label style={lbl}>{def.name}{def.unit ? ` (${def.unit})` : ""}</label>
                      {def.type === "SELECT" && (
                        <select
                          style={inp}
                          value={val.optionId ?? ""}
                          onChange={(e) => setVal({ optionId: e.target.value ? Number(e.target.value) : null })}
                        >
                          <option value="">— none —</option>
                          {def.options.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.value}</option>
                          ))}
                        </select>
                      )}
                      {def.type === "TEXT" && (
                        <input
                          type="text"
                          style={inp}
                          value={val.valueText ?? ""}
                          onChange={(e) => setVal({ valueText: e.target.value || null })}
                        />
                      )}
                      {def.type === "NUMBER" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <input
                            type="number"
                            style={{ ...inp, flex: 1 }}
                            value={val.valueNumber ?? ""}
                            onChange={(e) => setVal({ valueNumber: e.target.value || null })}
                          />
                          {def.unit && <span style={{ fontSize: 11, color: "#566070", flexShrink: 0 }}>{def.unit}</span>}
                        </div>
                      )}
                      {def.type === "BOOLEAN" && (
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={val.valueText === "true"}
                            onChange={(e) => setVal({ valueText: e.target.checked ? "true" : "false" })}
                          />
                          <span style={{ fontSize: 11, color: "#c8d0e0" }}>Yes</span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SEO */}
          <div style={card}>
            <p style={secTitle}>SEO</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div><label style={lbl}>Meta Title</label><input style={inp} value={product.metaTitle ?? ""} onChange={(e) => upd("metaTitle", e.target.value)} /></div>
              <div><label style={lbl}>Meta Description</label><input style={inp} value={product.metaDescription ?? ""} onChange={(e) => upd("metaDescription", e.target.value)} /></div>
            </div>
          </div>

        </div>

        {/* ── RIGHT sidebar — scrollable ── */}
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>

          {/* Status */}
          <div style={card}>
            <p style={secTitle}>Status</p>
            {(["isActive", "isFeatured"] as const).map((key) => (
              <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: key === "isActive" ? 6 : 0 }}>
                <span style={{ fontSize: 11, color: "#c8d0e0" }}>{key === "isActive" ? "Active" : "Featured"}</span>
                <Switch checked={product[key] as boolean} onCheckedChange={(v) => upd(key, v)} />
              </div>
            ))}
          </div>

          {/* Organization */}
          <div style={card}>
            <p style={secTitle}>Organization</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div><label style={lbl}>Category</label>
                <select style={inp} value={product.categoryId ?? ""} onChange={(e) => upd("categoryId", e.target.value ? Number(e.target.value) : null)}>
                  <option value="">No category</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Type</label>
                <select style={inp} value={product.type} onChange={(e) => upd("type", e.target.value)}>
                  {["SOFTWARE", "GAME", "SUBSCRIPTION", "DLC", "GIFT_CARD"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Sort Order</label>
                <input type="number" style={inp} value={product.sortOrder} onChange={(e) => upd("sortOrder", Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Region & Platform */}
          <div style={card}>
            <p style={secTitle}>Region &amp; Platform</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div>
                <label style={lbl}>Regions</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 4 }}>
                  {(product.regionRestrictions ?? []).map((r) => (
                    <span key={r} style={tag}>{r}
                      <button onClick={() => upd("regionRestrictions", (product.regionRestrictions ?? []).filter((x) => x !== r))} style={{ background: "none", border: "none", cursor: "pointer", color: "#60a5fa", padding: 0, display: "flex" }}><X size={9} /></button>
                    </span>
                  ))}
                </div>
                <select style={inp} value="" onChange={(e) => { if (e.target.value) { const cur = product.regionRestrictions ?? []; if (!cur.includes(e.target.value)) upd("regionRestrictions", [...cur, e.target.value]); } }}>
                  <option value="">Add region…</option>
                  {REGION_OPTIONS.filter((r) => !(product.regionRestrictions ?? []).includes(r)).map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Platform</label>
                <select style={inp} value={product.platformType ?? ""} onChange={(e) => upd("platformType", e.target.value || null)}>
                  <option value="">No platform</option>
                  {PLATFORM_OPTIONS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Image */}
          <div style={card}>
            <p style={secTitle}>Image</p>
            {product.imageUrl && (
              <div style={{ borderRadius: 4, overflow: "hidden", border: "1px solid #252836", marginBottom: 6 }}>
                <img src={product.imageUrl} alt="" style={{ width: "100%", height: 70, objectFit: "cover", display: "block" }} />
              </div>
            )}
            <input style={inp} value={product.imageUrl ?? ""} onChange={(e) => upd("imageUrl", e.target.value || null)} placeholder="Image URL…" />
          </div>

          {/* Related */}
          <div style={card}>
            <p style={secTitle}>Related Products</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 5 }}>
              {product.relatedProductIds.map((id) => {
                const rp = allProducts.find((p) => p.id === id);
                return rp ? <span key={id} style={tag}>{rp.name}<button onClick={() => upd("relatedProductIds", product.relatedProductIds.filter((x) => x !== id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#60a5fa", padding: 0, display: "flex" }}><X size={9} /></button></span> : null;
              })}
            </div>
            <select style={inp} value="" onChange={(e) => e.target.value && upd("relatedProductIds", [...product.relatedProductIds, Number(e.target.value)])}>
              <option value="">Add related…</option>
              {allProducts.filter((p) => !product.relatedProductIds.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Cross-sells */}
          <div style={card}>
            <p style={secTitle}>Cross-sells</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 5 }}>
              {product.crossSellProductIds.map((id) => {
                const rp = allProducts.find((p) => p.id === id);
                return rp ? <span key={id} style={tag}>{rp.name}<button onClick={() => upd("crossSellProductIds", product.crossSellProductIds.filter((x) => x !== id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#60a5fa", padding: 0, display: "flex" }}><X size={9} /></button></span> : null;
              })}
            </div>
            <select style={inp} value="" onChange={(e) => e.target.value && upd("crossSellProductIds", [...product.crossSellProductIds, Number(e.target.value)])}>
              <option value="">Add cross-sell…</option>
              {allProducts.filter((p) => !product.crossSellProductIds.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

        </div>
      </div>
    </div>
  );
}

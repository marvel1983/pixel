import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Save, ArrowLeft, Plus, X, Check } from "lucide-react";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { useAuthStore } from "@/stores/auth-store";
import { VariantPricingCard } from "./variant-pricing-card";
import { ProductEditSidebar } from "./product-edit-sidebar";
import { s } from "./product-edit-types";
import type { ProductData, VariantData, CategoryOption, ProductOption, TagDef, AttrDef, AttrValue } from "./product-edit-types";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export default function ProductEditPage() {
  const [, params] = useRoute("/admin/products/:id");
  const [, setLocation] = useLocation();
  const token = useAuthStore((st) => st.token) ?? "";

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
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [newV, setNewV] = useState({ name: "", sku: "", priceUsd: "", compareAtPriceUsd: "", stockCount: "0" });
  const [addingVariant, setAddingVariant] = useState(false);
  const [addVariantError, setAddVariantError] = useState("");
  const [variantDrafts, setVariantDrafts] = useState<Map<number, Partial<VariantData>>>(new Map());

  const [allTags, setAllTags] = useState<TagDef[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [allAttributeDefs, setAllAttributeDefs] = useState<AttrDef[]>([]);
  const [attributeValues, setAttributeValues] = useState<Map<number, AttrValue>>(new Map());

  const productId = params?.id;
  const authHdr = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!productId) return;
    Promise.all([
      fetch(`${API_URL}/admin/products/${productId}`, { headers: authHdr }).then((r) => r.json()),
      fetch(`${API_URL}/admin/tags`, { headers: authHdr }).then((r) => r.json()).catch(() => []),
      fetch(`${API_URL}/admin/products/${productId}/tags`, { headers: authHdr }).then((r) => r.json()).catch(() => []),
      fetch(`${API_URL}/admin/attributes`, { headers: authHdr }).then((r) => r.json()).catch(() => []),
      fetch(`${API_URL}/admin/products/${productId}/attributes`, { headers: authHdr }).then((r) => r.json()).catch(() => []),
    ]).then(async ([d, tagsData, productTagsData, attrsData, productAttrsData]) => {
      setProduct({ ...d.product, keyFeatures: d.product.keyFeatures ?? [], systemRequirements: d.product.systemRequirements ?? {}, relatedProductIds: d.product.relatedProductIds ?? [], crossSellProductIds: d.product.crossSellProductIds ?? [], activationInstructions: d.product.activationInstructions ?? null });
      setVariants(d.variants);
      setCats(d.categories);
      setAllProducts(d.allProducts ?? []);

      const tagsArr: TagDef[] = Array.isArray(tagsData) ? tagsData : tagsData.tags ?? [];
      setAllTags(tagsArr);
      setSelectedTagIds(Array.isArray(productTagsData) ? productTagsData : productTagsData.tagIds ?? []);

      const defsArr = Array.isArray(attrsData) ? attrsData : attrsData.attributes ?? [];
      const selectDefs = defsArr.filter((a: { type: string }) => a.type === "SELECT");
      const optionsMap = new Map<number, { id: number; value: string; slug: string; colorHex: string | null }[]>();
      await Promise.all(selectDefs.map(async (def: { id: number }) => {
        const opts = await fetch(`${API_URL}/admin/attributes/${def.id}/options`, { headers: authHdr }).then((r) => r.json()).catch(() => []);
        optionsMap.set(def.id, Array.isArray(opts) ? opts : opts.options ?? []);
      }));
      setAllAttributeDefs(defsArr.map((def: AttrDef) => ({ ...def, options: optionsMap.get(def.id) ?? [] })));

      const prodAttrsArr = Array.isArray(productAttrsData) ? productAttrsData : productAttrsData.attributes ?? [];
      const valMap = new Map<number, AttrValue>();
      for (const pa of prodAttrsArr) {
        valMap.set(pa.attributeId, { optionId: pa.optionId ?? null, valueText: pa.valueText ?? null, valueNumber: pa.valueNumber ?? null });
      }
      setAttributeValues(valMap);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [productId, token]);

  function upd<K extends keyof ProductData>(key: K, value: ProductData[K]) {
    setProduct((p) => p ? { ...p, [key]: value } : p);
    setSaved(false);
  }

  function patchVariant(id: number, patch: Partial<VariantData>) {
    setVariantDrafts((prev) => { const next = new Map(prev); next.set(id, { ...(next.get(id) ?? {}), ...patch }); return next; });
    setVariants((vs) => vs.map((v) => v.id === id ? { ...v, ...patch } : v));
    setSaved(false);
  }

  async function handleSave() {
    if (!product) return;
    setSaving(true);
    await fetch(`${API_URL}/admin/products/${product.id}`, { method: "PUT", headers: { ...authHdr, "Content-Type": "application/json" }, body: JSON.stringify(product) });
    if (variantDrafts.size > 0) {
      await Promise.all(Array.from(variantDrafts.entries()).map(([variantId, patch]) =>
        fetch(`${API_URL}/admin/variants/${variantId}`, { method: "PATCH", headers: { ...authHdr, "Content-Type": "application/json" }, body: JSON.stringify(patch) })
      ));
      setVariantDrafts(new Map());
    }
    await fetch(`${API_URL}/admin/products/${product.id}/tags`, { method: "PUT", headers: { ...authHdr, "Content-Type": "application/json" }, body: JSON.stringify({ tagIds: selectedTagIds }) }).catch(() => {});
    await fetch(`${API_URL}/admin/products/${product.id}/attributes`, { method: "PUT", headers: { ...authHdr, "Content-Type": "application/json" }, body: JSON.stringify({ attributes: Array.from(attributeValues.entries()).map(([attributeId, v]) => ({ attributeId, ...v })) }) }).catch(() => {});
    setSaving(false);
    setSaved(true);
  }

  async function handleAddVariant() {
    if (!product) return;
    if (!newV.name.trim() || !newV.sku.trim() || !newV.priceUsd) { setAddVariantError("Name, SKU and Price are required"); return; }
    setAddingVariant(true); setAddVariantError("");
    const res = await fetch(`${API_URL}/admin/products/${product.id}/variants`, { method: "POST", headers: { ...authHdr, "Content-Type": "application/json" }, body: JSON.stringify({ name: newV.name.trim(), sku: newV.sku.trim(), priceUsd: newV.priceUsd, compareAtPriceUsd: newV.compareAtPriceUsd || undefined, stockCount: Number(newV.stockCount) || 0 }) });
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
  }

  async function handleDeleteVariant(variantId: number) {
    await fetch(`${API_URL}/admin/variants/${variantId}`, { method: "DELETE", headers: authHdr });
    setVariants((v) => v.filter((x) => x.id !== variantId));
  }

  if (loading) return <div style={{ height: 300, ...s.card }} />;
  if (!product) return <div style={{ padding: 40, textAlign: "center", color: "#566070" }}>Product not found.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%", overflow: "hidden" }}>

      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button onClick={() => setLocation("/admin/products")} style={{ ...s.card, padding: "4px 7px", color: "#8b94a8", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}>
          <ArrowLeft size={13} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</span>
        <span style={{ fontSize: 10, borderRadius: 3, padding: "2px 7px", background: product.isActive ? "#0a2015" : "#1f2330", color: product.isActive ? "#4ade80" : "#566070", border: `1px solid ${product.isActive ? "#166534" : "#252836"}`, flexShrink: 0 }}>
          {product.isActive ? "Active" : "Inactive"}
        </span>
        <button onClick={handleSave} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 5, background: saved ? "#0a2015" : "#1e3a8a", border: `1px solid ${saved ? "#166534" : "#2563eb"}`, color: saved ? "#4ade80" : "#93c5fd", borderRadius: 4, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", flexShrink: 0 }}>
          <Save size={12} /> {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 210px", gap: 8, flex: 1, minHeight: 0 }}>

        {/* LEFT — scrollable */}
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>

          {/* Basic Info */}
          <div style={s.card}>
            <p style={s.secTitle}>Basic Info</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
              <div><label style={s.lbl}>Name</label><input style={s.inp} value={product.name} onChange={(e) => upd("name", e.target.value)} /></div>
              <div><label style={s.lbl}>Slug</label><input style={s.inp} value={product.slug} onChange={(e) => upd("slug", e.target.value)} /></div>
            </div>
            <div>
              <label style={s.lbl}>Short Description</label>
              <textarea style={{ ...s.inp, resize: "none", height: 42 }} value={product.shortDescription ?? ""} onChange={(e) => upd("shortDescription", e.target.value)} />
            </div>
          </div>

          {/* Description */}
          <div style={s.card}>
            <p style={s.secTitle}>Description</p>
            <RichTextEditor content={product.description ?? ""} onChange={(html) => upd("description", html)} placeholder="Write product description…" />
          </div>

          {/* Activation Instructions */}
          <div style={s.card}>
            <p style={s.secTitle}>Activation Instructions</p>
            <p style={{ fontSize: 10, color: "#566070", marginBottom: 6, marginTop: -4 }}>Shown to customers in the key delivery email. Auto-synced from Metenzi — manual edits will be overwritten on next stock sync.</p>
            <textarea
              style={{ ...s.inp, resize: "vertical", minHeight: 80, fontFamily: "inherit", lineHeight: 1.5 }}
              value={product.activationInstructions ?? ""}
              onChange={(e) => upd("activationInstructions", e.target.value || null)}
              placeholder="e.g. 1. Go to store.steampowered.com&#10;2. Click 'Add a Game' → 'Activate a Product on Steam'&#10;3. Enter your key and follow the prompts"
            />
          </div>

          {/* Pricing & Variants */}
          <div style={s.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ ...s.secTitle, marginBottom: 0 }}>Pricing &amp; Variants</p>
              <button onClick={() => { setShowAddVariant((v) => !v); setAddVariantError(""); }} style={{ display: "flex", alignItems: "center", gap: 4, background: "#1e3a8a", border: "1px solid #2563eb", color: "#93c5fd", borderRadius: 4, padding: "3px 9px", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                <Plus size={11} /> Add Variant
              </button>
            </div>

            {showAddVariant && (
              <div style={{ background: "#13161e", border: "1px solid #252836", borderRadius: 5, padding: "8px 10px", marginBottom: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px 90px 70px", gap: 6 }}>
                  <div><label style={s.lbl}>Name</label><input style={s.inp} placeholder="e.g. Standard Key" value={newV.name} onChange={(e) => setNewV((v) => ({ ...v, name: e.target.value }))} /></div>
                  <div><label style={s.lbl}>SKU</label><input style={s.inp} placeholder="e.g. MS-OFF-2024" value={newV.sku} onChange={(e) => setNewV((v) => ({ ...v, sku: e.target.value }))} /></div>
                  <div><label style={s.lbl}>Price (EUR)</label><input style={s.inp} type="number" placeholder="0.00" value={newV.priceUsd} onChange={(e) => setNewV((v) => ({ ...v, priceUsd: e.target.value }))} /></div>
                  <div><label style={s.lbl}>Compare At</label><input style={s.inp} type="number" placeholder="0.00" value={newV.compareAtPriceUsd} onChange={(e) => setNewV((v) => ({ ...v, compareAtPriceUsd: e.target.value }))} /></div>
                  <div><label style={s.lbl}>Stock</label><input style={s.inp} type="number" placeholder="0" value={newV.stockCount} onChange={(e) => setNewV((v) => ({ ...v, stockCount: e.target.value }))} /></div>
                </div>
                {addVariantError && <p style={{ fontSize: 10, color: "#f87171", margin: 0 }}>{addVariantError}</p>}
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => { setShowAddVariant(false); setAddVariantError(""); }} style={{ background: "none", border: "1px solid #252836", color: "#8b94a8", borderRadius: 4, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                  <button onClick={handleAddVariant} disabled={addingVariant} style={{ display: "flex", alignItems: "center", gap: 4, background: "#0a2015", border: "1px solid #166534", color: "#4ade80", borderRadius: 4, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: addingVariant ? "not-allowed" : "pointer", opacity: addingVariant ? 0.6 : 1 }}>
                    <Check size={11} /> {addingVariant ? "Saving…" : "Save Variant"}
                  </button>
                </div>
              </div>
            )}

            {variants.length === 0
              ? <p style={{ fontSize: 11, color: "#566070" }}>No variants yet. Click "Add Variant" to create one.</p>
              : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {variants.map((v) => <VariantPricingCard key={v.id} variant={v} onUpdate={patchVariant} onDelete={handleDeleteVariant} />)}
                </div>
            }
          </div>

          {/* Key Features */}
          <div style={s.card}>
            <p style={s.secTitle}>Key Features</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
              {product.keyFeatures.map((f, i) => (
                <span key={i} style={s.tag}>{f}
                  <button onClick={() => upd("keyFeatures", product.keyFeatures.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#60a5fa", padding: 0, display: "flex" }}><X size={9} /></button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <input style={{ ...s.inp, flex: 1 }} placeholder="Add feature and press Enter…" value={newFeature} onChange={(e) => setNewFeature(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newFeature.trim()) { e.preventDefault(); upd("keyFeatures", [...product.keyFeatures, newFeature.trim()]); setNewFeature(""); } }} />
              <button style={s.iconBtn} onClick={() => { if (newFeature.trim()) { upd("keyFeatures", [...product.keyFeatures, newFeature.trim()]); setNewFeature(""); } }}><Plus size={13} /></button>
            </div>
          </div>

          {/* System Requirements */}
          <div style={s.card}>
            <p style={s.secTitle}>System Requirements</p>
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
              <input style={{ ...s.inp, width: 100, flex: "none" }} placeholder="e.g. OS" value={newReqKey} onChange={(e) => setNewReqKey(e.target.value)} />
              <input style={{ ...s.inp, flex: 1 }} placeholder="e.g. Windows 10+" value={newReqVal} onChange={(e) => setNewReqVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newReqKey.trim() && newReqVal.trim()) { e.preventDefault(); upd("systemRequirements", { ...product.systemRequirements, [newReqKey.trim()]: newReqVal.trim() }); setNewReqKey(""); setNewReqVal(""); } }} />
              <button style={s.iconBtn} onClick={() => { if (newReqKey.trim() && newReqVal.trim()) { upd("systemRequirements", { ...product.systemRequirements, [newReqKey.trim()]: newReqVal.trim() }); setNewReqKey(""); setNewReqVal(""); } }}><Plus size={13} /></button>
            </div>
          </div>

          {/* Tags */}
          <div style={s.card}>
            <p style={s.secTitle}>Tags</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
              {selectedTagIds.map((tid) => {
                const t = allTags.find((x) => x.id === tid);
                if (!t) return null;
                return (
                  <span key={tid} style={{ display: "inline-flex", alignItems: "center", gap: 3, background: t.colorHex ?? "#3b82f6", color: "#fff", borderRadius: 3, padding: "2px 6px", fontSize: 10, fontWeight: 600 }}>
                    {t.name}
                    <button onClick={() => setSelectedTagIds((ids) => ids.filter((x) => x !== tid))} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 0, display: "flex" }}><X size={9} /></button>
                  </span>
                );
              })}
              {selectedTagIds.length === 0 && <span style={{ fontSize: 11, color: "#566070" }}>No tags assigned.</span>}
            </div>
            <select style={s.inp} value="" onChange={(e) => { const val = Number(e.target.value); if (val && !selectedTagIds.includes(val)) { setSelectedTagIds((ids) => [...ids, val]); setSaved(false); } }}>
              <option value="">Add tag…</option>
              {allTags.filter((t) => !selectedTagIds.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Attributes */}
          <div style={s.card}>
            <p style={s.secTitle}>Attributes</p>
            {allAttributeDefs.length === 0
              ? <p style={{ fontSize: 11, color: "#566070" }}>No attribute definitions configured.</p>
              : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {allAttributeDefs.map((def) => {
                    const val = attributeValues.get(def.id) ?? { optionId: null, valueText: null, valueNumber: null };
                    const setVal = (patch: Partial<AttrValue>) => { setAttributeValues((prev) => { const next = new Map(prev); next.set(def.id, { ...val, ...patch }); return next; }); setSaved(false); };
                    return (
                      <div key={def.id}>
                        <label style={s.lbl}>{def.name}{def.unit ? ` (${def.unit})` : ""}</label>
                        {def.type === "SELECT" && <select style={s.inp} value={val.optionId ?? ""} onChange={(e) => setVal({ optionId: e.target.value ? Number(e.target.value) : null })}><option value="">— none —</option>{def.options.map((opt) => <option key={opt.id} value={opt.id}>{opt.value}</option>)}</select>}
                        {def.type === "TEXT" && <input type="text" style={s.inp} value={val.valueText ?? ""} onChange={(e) => setVal({ valueText: e.target.value || null })} />}
                        {def.type === "NUMBER" && <div style={{ display: "flex", alignItems: "center", gap: 5 }}><input type="number" style={{ ...s.inp, flex: 1 }} value={val.valueNumber ?? ""} onChange={(e) => setVal({ valueNumber: e.target.value || null })} />{def.unit && <span style={{ fontSize: 11, color: "#566070", flexShrink: 0 }}>{def.unit}</span>}</div>}
                        {def.type === "BOOLEAN" && <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="checkbox" checked={val.valueText === "true"} onChange={(e) => setVal({ valueText: e.target.checked ? "true" : "false" })} /><span style={{ fontSize: 11, color: "#c8d0e0" }}>Yes</span></label>}
                      </div>
                    );
                  })}
                </div>
            }
          </div>

          {/* SEO */}
          <div style={s.card}>
            <p style={s.secTitle}>SEO</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div><label style={s.lbl}>Meta Title</label><input style={s.inp} value={product.metaTitle ?? ""} onChange={(e) => upd("metaTitle", e.target.value)} /></div>
              <div><label style={s.lbl}>Meta Description</label><input style={s.inp} value={product.metaDescription ?? ""} onChange={(e) => upd("metaDescription", e.target.value)} /></div>
            </div>
          </div>

        </div>

        {/* RIGHT sidebar */}
        <ProductEditSidebar product={product} cats={cats} allProducts={allProducts} token={token} onChange={upd} />

      </div>
    </div>
  );
}

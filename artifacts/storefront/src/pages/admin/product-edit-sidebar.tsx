import { X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { ProductData, CategoryOption, ProductOption } from "./product-edit-types";
import { s, REGION_OPTIONS, PLATFORM_OPTIONS } from "./product-edit-types";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface Props {
  product: ProductData;
  cats: CategoryOption[];
  allProducts: ProductOption[];
  token: string;
  onChange: <K extends keyof ProductData>(key: K, value: ProductData[K]) => void;
}

export function ProductEditSidebar({ product, cats, allProducts, token, onChange }: Props) {
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch(`${API_URL}/admin/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ data: reader.result, mimeType: file.type, filename: file.name }),
        });
        if (!res.ok) { const err = await res.json(); alert(err.error ?? "Upload failed"); return; }
        const { url } = await res.json();
        const apiBase = API_URL.replace(/\/api\/?$/, "");
        onChange("imageUrl", apiBase ? `${apiBase}${url}` : url);
      } catch { alert("Upload failed"); }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>

      {/* Status */}
      <div style={s.card}>
        <p style={s.secTitle}>Status</p>
        {(["isActive", "isFeatured"] as const).map((key) => (
          <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: key === "isActive" ? 6 : 0 }}>
            <span style={{ fontSize: 11, color: "#c8d0e0" }}>{key === "isActive" ? "Active" : "Featured"}</span>
            <Switch checked={product[key] as boolean} onCheckedChange={(v) => onChange(key, v)} />
          </div>
        ))}
      </div>

      {/* Organization */}
      <div style={s.card}>
        <p style={s.secTitle}>Organization</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div>
            <label style={s.lbl}>Category</label>
            <select style={s.inp} value={product.categoryId ?? ""} onChange={(e) => onChange("categoryId", e.target.value ? Number(e.target.value) : null)}>
              <option value="">No category</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={s.lbl}>Type</label>
            <select style={s.inp} value={product.type} onChange={(e) => onChange("type", e.target.value)}>
              {["SOFTWARE", "GAME", "SUBSCRIPTION", "DLC", "GIFT_CARD"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={s.lbl}>Sort Order</label>
            <input type="number" style={s.inp} value={product.sortOrder} onChange={(e) => onChange("sortOrder", Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Region & Platform */}
      <div style={s.card}>
        <p style={s.secTitle}>Region &amp; Platform</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div>
            <label style={s.lbl}>Regions</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 4 }}>
              {(product.regionRestrictions ?? []).map((r) => (
                <span key={r} style={s.tag}>{r}
                  <button onClick={() => onChange("regionRestrictions", (product.regionRestrictions ?? []).filter((x) => x !== r))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#60a5fa", padding: 0, display: "flex" }}>
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
            <select style={s.inp} value="" onChange={(e) => {
              if (!e.target.value) return;
              const cur = product.regionRestrictions ?? [];
              if (!cur.includes(e.target.value)) onChange("regionRestrictions", [...cur, e.target.value]);
            }}>
              <option value="">Add region…</option>
              {REGION_OPTIONS.filter((r) => !(product.regionRestrictions ?? []).includes(r)).map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={s.lbl}>Platform</label>
            <select style={s.inp} value={product.platformType ?? ""} onChange={(e) => onChange("platformType", e.target.value || null)}>
              <option value="">No platform</option>
              {PLATFORM_OPTIONS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Image */}
      <div style={s.card}>
        <p style={s.secTitle}>Image</p>
        {product.imageUrl && (
          <div style={{ borderRadius: 4, overflow: "hidden", border: "1px solid #252836", marginBottom: 6 }}>
            <img src={product.imageUrl} alt="" style={{ width: "100%", height: 70, objectFit: "cover", display: "block" }} />
          </div>
        )}
        <input style={s.inp} value={product.imageUrl ?? ""} onChange={(e) => onChange("imageUrl", e.target.value || null)} placeholder="Image URL…" />
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
          <input id="img-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={handleImageUpload} />
          <button type="button" onClick={() => document.getElementById("img-file-input")?.click()}
            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 4, border: "1px solid #3b4162", background: "#1e2235", color: "#a0aec0", cursor: "pointer", whiteSpace: "nowrap" }}>
            Upload image
          </button>
          <span style={{ fontSize: 10, color: "#4a5568" }}>JPEG, PNG, WebP, GIF · max 5 MB</span>
        </div>
      </div>

      {/* Related Products */}
      <div style={s.card}>
        <p style={s.secTitle}>Related Products</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 5 }}>
          {product.relatedProductIds.map((id) => {
            const rp = allProducts.find((p) => p.id === id);
            return rp ? (
              <span key={id} style={s.tag}>{rp.name}
                <button onClick={() => onChange("relatedProductIds", product.relatedProductIds.filter((x) => x !== id))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#60a5fa", padding: 0, display: "flex" }}>
                  <X size={9} />
                </button>
              </span>
            ) : null;
          })}
        </div>
        <select style={s.inp} value="" onChange={(e) => e.target.value && onChange("relatedProductIds", [...product.relatedProductIds, Number(e.target.value)])}>
          <option value="">Add related…</option>
          {allProducts.filter((p) => !product.relatedProductIds.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Cross-sells */}
      <div style={s.card}>
        <p style={s.secTitle}>Cross-sells</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 5 }}>
          {product.crossSellProductIds.map((id) => {
            const rp = allProducts.find((p) => p.id === id);
            return rp ? (
              <span key={id} style={s.tag}>{rp.name}
                <button onClick={() => onChange("crossSellProductIds", product.crossSellProductIds.filter((x) => x !== id))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#60a5fa", padding: 0, display: "flex" }}>
                  <X size={9} />
                </button>
              </span>
            ) : null;
          })}
        </div>
        <select style={s.inp} value="" onChange={(e) => e.target.value && onChange("crossSellProductIds", [...product.crossSellProductIds, Number(e.target.value)])}>
          <option value="">Add cross-sell…</option>
          {allProducts.filter((p) => !product.crossSellProductIds.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

    </div>
  );
}

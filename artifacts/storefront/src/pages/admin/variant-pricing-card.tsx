import { Trash2 } from "lucide-react";
import type { VariantData } from "./product-edit-types";

interface Props {
  variant: VariantData;
  onUpdate: (id: number, patch: Partial<VariantData>) => void;
  onDelete: (id: number) => void;
}

const numInp: React.CSSProperties = {
  width: "100%", background: "#0f1117", border: "1px solid #1f2330",
  borderRadius: 4, padding: "5px 8px", fontSize: 12, color: "#c8d0e0",
  outline: "none", boxSizing: "border-box",
};
const derivedInp: React.CSSProperties = {
  ...numInp, border: "1px solid #2a3a5a", background: "#0d1520", color: "#60a5fa",
};
const fieldCard: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3, flex: 1 };
const fieldLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: "#566070", textTransform: "uppercase", letterSpacing: "0.06em",
};

function DollarInput({ style, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { style?: React.CSSProperties }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#566070" }}>€</span>
      <input type="number" style={{ ...style, paddingLeft: 18 }} {...props} />
    </div>
  );
}

export function VariantPricingCard({ variant, onUpdate, onDelete }: Props) {
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
      onUpdate(variant.id, { priceUsd: (cost / (1 - pct / 100)).toFixed(2) });
    }
    e.target.value = selling > 0 ? derivedMarginPct.toFixed(2) : "";
  }

  function handleMarginAmtBlur(e: React.FocusEvent<HTMLInputElement>) {
    const amt = parseFloat(e.target.value);
    if (!isNaN(amt) && cost >= 0) {
      onUpdate(variant.id, { priceUsd: Math.max(0, cost + amt).toFixed(2) });
    }
    e.target.value = selling > 0 ? derivedMarginAmt.toFixed(2) : "";
  }

  return (
    <div style={{ border: "1px solid #252836", borderRadius: 6, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#13161e", borderBottom: "1px solid #252836" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#c8d0e0", flex: 1 }}>{variant.name}</span>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "#566070" }}>{variant.sku}</span>
        <span
          style={{ fontSize: 9, borderRadius: 3, padding: "1px 6px", cursor: "pointer", background: variant.isActive ? "#0a2015" : "#1f2330", color: variant.isActive ? "#4ade80" : "#566070", border: `1px solid ${variant.isActive ? "#166534" : "#252836"}` }}
          onClick={() => set("isActive", !variant.isActive)}
        >
          {variant.isActive ? "Active" : "Inactive"}
        </span>
        <button onClick={() => onDelete(variant.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#3a4255", display: "flex", padding: 2 }} title="Delete variant">
          <Trash2 size={12} />
        </button>
      </div>

      {/* Pricing grid */}
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Row 1: Cost | Selling | Margin % | Margin $ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
          <div style={fieldCard}>
            <span style={fieldLabel}>Cost Price</span>
            <DollarInput style={{ ...numInp, border: "1px solid #1f2a3a" }} placeholder="0.00" value={variant.costPriceUsd ?? ""} onChange={(e) => set("costPriceUsd", e.target.value || null)} />
          </div>
          <div style={fieldCard}>
            <span style={fieldLabel}>Selling Price</span>
            <DollarInput style={{ ...numInp, border: "1px solid #1e3a8a" }} placeholder="0.00" value={variant.priceUsd} onChange={(e) => set("priceUsd", e.target.value)} />
          </div>
          <div style={fieldCard}>
            <span style={{ ...fieldLabel, color: "#4a6a9a" }}>Margin %</span>
            <div style={{ position: "relative" }}>
              <input type="number" style={{ ...derivedInp, paddingRight: 22 }} placeholder="—"
                defaultValue={selling > 0 && cost >= 0 ? derivedMarginPct.toFixed(2) : ""}
                key={`mpct-${variant.id}-${variant.priceUsd}-${variant.costPriceUsd}`}
                onBlur={handleMarginPctBlur} title="Edit to change selling price" />
              <span style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#4a6a9a" }}>%</span>
            </div>
          </div>
          <div style={fieldCard}>
            <span style={{ ...fieldLabel, color: "#4a6a9a" }}>Margin $</span>
            <DollarInput style={derivedInp} placeholder="—"
              defaultValue={selling > 0 && cost >= 0 ? derivedMarginAmt.toFixed(2) : ""}
              key={`mamt-${variant.id}-${variant.priceUsd}-${variant.costPriceUsd}`}
              onBlur={handleMarginAmtBlur} title="Edit to change selling price" />
          </div>
        </div>

        {/* Row 2: Compare At | Sale Price | B2B | Stock */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 0.7fr", gap: 8 }}>
          <div style={fieldCard}>
            <span style={fieldLabel}>Compare At</span>
            <DollarInput style={numInp} placeholder="0.00" value={variant.compareAtPriceUsd ?? ""} onChange={(e) => set("compareAtPriceUsd", e.target.value || null)} />
          </div>
          <div style={fieldCard}>
            <span style={fieldLabel}>
              Sale Price {saleDiscount > 0 && <span style={{ marginLeft: 5, color: "#f87171", fontSize: 9 }}>-{saleDiscount}% off</span>}
            </span>
            <DollarInput
              style={{ ...numInp, border: salePrice > 0 ? "1px solid #7f1d1d" : "1px solid #1f2330", background: salePrice > 0 ? "#1a0a0a" : "#0f1117" }}
              placeholder="0.00 (empty = none)" value={variant.priceOverrideUsd ?? ""}
              onChange={(e) => set("priceOverrideUsd", e.target.value || null)} />
          </div>
          <div style={fieldCard}>
            <span style={fieldLabel}>B2B Price</span>
            <DollarInput style={numInp} placeholder="0.00 (optional)" value={variant.b2bPriceUsd ?? ""} onChange={(e) => set("b2bPriceUsd", e.target.value || null)} />
          </div>
          <div style={fieldCard}>
            <span style={fieldLabel}>Stock</span>
            <input type="number" style={{ ...numInp, color: variant.stockCount === 0 ? "#f87171" : variant.stockCount < 5 ? "#fbbf24" : "#c8d0e0" }}
              value={variant.stockCount} onChange={(e) => set("stockCount", Number(e.target.value) || 0)} />
          </div>
        </div>
      </div>
    </div>
  );
}

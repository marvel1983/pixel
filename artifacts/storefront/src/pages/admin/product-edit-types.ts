export interface ProductData {
  id: number; name: string; slug: string;
  shortDescription: string | null; description: string | null;
  type: string; categoryId: number | null; imageUrl: string | null;
  metaTitle: string | null; metaDescription: string | null;
  isFeatured: boolean; isActive: boolean; sortOrder: number;
  keyFeatures: string[]; systemRequirements: Record<string, string>;
  relatedProductIds: number[]; crossSellProductIds: number[];
  regionRestrictions: string[]; platformType: string | null;
  activationInstructions: string | null;
}

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
export interface TagDef { id: number; name: string; slug: string; colorHex: string | null; }
export interface AttrOptionDef { id: number; value: string; slug: string; colorHex: string | null; }
export interface AttrDef {
  id: number; name: string; slug: string;
  type: "SELECT" | "TEXT" | "BOOLEAN" | "NUMBER";
  unit: string | null; isVisibleOnPdp: boolean; options: AttrOptionDef[];
}
export interface AttrValue { optionId: number | null; valueText: string | null; valueNumber: string | null; }

export const REGION_OPTIONS = ["EU", "NA", "LATAM", "ASIA", "RU", "UK"];
export const PLATFORM_OPTIONS = ["STEAM", "ORIGIN", "UPLAY", "GOG", "EPIC", "BATTLENET", "MICROSOFT", "XBOX", "PLAYSTATION", "NINTENDO"];

export const s = {
  inp: {
    width: "100%", background: "#0f1117", border: "1px solid #1f2330",
    borderRadius: 4, padding: "4px 8px", fontSize: 12, color: "#c8d0e0",
    outline: "none", boxSizing: "border-box",
  } as React.CSSProperties,
  secTitle: {
    fontSize: 10, fontWeight: 700, color: "#566070", textTransform: "uppercase",
    letterSpacing: "0.07em", marginBottom: 8,
  } as React.CSSProperties,
  lbl: {
    fontSize: 10, fontWeight: 600, color: "#566070", textTransform: "uppercase",
    letterSpacing: "0.05em", marginBottom: 3, display: "block",
  } as React.CSSProperties,
  card: {
    background: "#1a1d28", border: "1px solid #252836", borderRadius: 6, padding: "10px 12px",
  } as React.CSSProperties,
  tag: {
    display: "inline-flex", alignItems: "center", gap: 3,
    background: "#1e2a4a", color: "#93c5fd", borderRadius: 3, padding: "2px 6px", fontSize: 10,
  } as React.CSSProperties,
  iconBtn: {
    background: "#1e2a4a", border: "1px solid #2a3a5a", color: "#60a5fa",
    borderRadius: 4, padding: "4px 7px", cursor: "pointer", display: "flex", alignItems: "center",
  } as React.CSSProperties,
};

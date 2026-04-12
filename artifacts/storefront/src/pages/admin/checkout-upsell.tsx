import { useState, useEffect, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Package, Search, Zap, Clock, Tag, ShoppingCart, TrendingUp, X, Check, History } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface UpsellConfig {
  id: number; productId: number; isActive: boolean;
  displayPrice: string | null; strikethroughPrice: string | null;
  urgencyMessage: string | null; checkboxLabel: string | null;
  createdAt: string; productName: string; productSlug: string; productImage: string | null;
}
interface Product { id: number; name: string; imageUrl: string | null }

/* ── shared styles ── */
const card  = (accent?: string): React.CSSProperties => ({
  background: "#1a1d28", border: `1px solid ${accent ?? "#252836"}`,
  borderRadius: 10, padding: "16px 18px",
});
const inp: React.CSSProperties = {
  width: "100%", background: "#0f1117", border: "1px solid #1f2330",
  borderRadius: 6, padding: "7px 11px", fontSize: 12, color: "#c8d0e0",
  outline: "none", boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "#566070", textTransform: "uppercase",
  letterSpacing: "0.06em", marginBottom: 4, display: "block",
};
const secTitle = (color = "#e2e8f0"): React.CSSProperties => ({
  fontSize: 12, fontWeight: 700, color, margin: 0, display: "flex", alignItems: "center", gap: 6,
});

export default function CheckoutUpsellPage() {
  const token = useAuthStore((s) => s.token);
  const [current, setCurrent]       = useState<UpsellConfig | null>(null);
  const [history, setHistory]       = useState<UpsellConfig[]>([]);
  const [productId, setProductId]   = useState<number | null>(null);
  const [productName, setProductName]   = useState("");
  const [productImage, setProductImage] = useState<string | null>(null);
  const [displayPrice, setDisplayPrice]             = useState("");
  const [strikethroughPrice, setStrikethroughPrice] = useState("");
  const [urgencyMessage, setUrgencyMessage]         = useState("");
  const [checkboxLabel, setCheckboxLabel]           = useState("");
  const [searchQ, setSearchQ]           = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearch, setShowSearch]     = useState(false);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(() => {
    fetch(`${API}/admin/checkout-upsell`, { headers: h })
      .then((r) => r.json())
      .then((d) => { setCurrent(d.current); setHistory(d.history); })
      .catch(() => {});
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      fetch(`${API}/admin/products?q=${encodeURIComponent(searchQ)}`, { headers: h })
        .then((r) => r.json())
        .then((d) => setSearchResults(d.products?.slice(0, 8) ?? []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  const selectProduct = (p: Product) => {
    setProductId(p.id); setProductName(p.name); setProductImage(p.imageUrl);
    setShowSearch(false); setSearchQ("");
  };

  const save = async () => {
    if (!productId) return;
    setSaving(true); setSaved(false);
    await fetch(`${API}/admin/checkout-upsell`, {
      method: "POST", headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({
        productId, displayPrice: displayPrice || null,
        strikethroughPrice: strikethroughPrice || null,
        urgencyMessage: urgencyMessage || null, checkboxLabel: checkboxLabel || null,
      }),
    });
    setSaving(false); setSaved(true); fetchData();
    setTimeout(() => setSaved(false), 2500);
  };

  const toggle = async (id: number) => {
    await fetch(`${API}/admin/checkout-upsell/${id}/toggle`, { method: "PATCH", headers: { ...h, "Content-Type": "application/json" } });
    fetchData();
  };

  const quickSwitch = (cfg: UpsellConfig) => {
    setProductId(cfg.productId); setProductName(cfg.productName); setProductImage(cfg.productImage);
    setDisplayPrice(cfg.displayPrice ?? ""); setStrikethroughPrice(cfg.strikethroughPrice ?? "");
    setUrgencyMessage(cfg.urgencyMessage ?? ""); setCheckboxLabel(cfg.checkboxLabel ?? "");
    setSaved(false);
  };

  /* savings % badge */
  const savePct = displayPrice && strikethroughPrice
    ? Math.round((1 - parseFloat(displayPrice) / parseFloat(strikethroughPrice)) * 100)
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", overflowY: "auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <div style={{ background: "linear-gradient(135deg,#1e3a8a,#7c3aed)", borderRadius: 8, padding: "6px 7px", display: "flex" }}>
              <ShoppingCart size={14} color="#fff" />
            </div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Checkout Upsell</h1>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "#566070" }}>Configure the featured product offer shown at checkout</p>
        </div>
        {current && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1a1d28", border: "1px solid #252836", borderRadius: 8, padding: "6px 12px" }}>
            <span style={{ fontSize: 11, color: current.isActive ? "#4ade80" : "#566070", fontWeight: 600 }}>
              {current.isActive ? "● Live" : "○ Paused"}
            </span>
            <Switch checked={current.isActive} onCheckedChange={() => toggle(current.id)} />
          </div>
        )}
      </div>

      {/* ── Current active upsell banner ── */}
      {current ? (
        <div style={{ ...card("#2563eb40"), background: "linear-gradient(135deg, #0f1a3a 0%, #1a1d28 60%)", position: "relative", overflow: "hidden" }}>
          {/* decorative glow */}
          <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(99,102,241,0.15)", filter: "blur(30px)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
            <TrendingUp size={12} color="#6366f1" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.07em" }}>Current Upsell Product</span>
            <span style={{ marginLeft: "auto", fontSize: 10, borderRadius: 20, padding: "2px 10px", fontWeight: 700,
              background: current.isActive ? "#0a2015" : "#1f2330",
              color: current.isActive ? "#4ade80" : "#566070",
              border: `1px solid ${current.isActive ? "#166534" : "#252836"}` }}>
              {current.isActive ? "ACTIVE" : "PAUSED"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: 10, border: "1px solid #252836", background: "#13161e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
              {current.productImage
                ? <img src={current.productImage} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <Package size={24} color="#3a4255" />}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 5px", fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{current.productName}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {current.displayPrice && (
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#4ade80" }}>${current.displayPrice}</span>
                )}
                {current.strikethroughPrice && (
                  <span style={{ fontSize: 13, color: "#566070", textDecoration: "line-through" }}>${current.strikethroughPrice}</span>
                )}
                {current.displayPrice && current.strikethroughPrice && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: "#7c3aed20", color: "#a78bfa", border: "1px solid #7c3aed40", borderRadius: 4, padding: "2px 6px" }}>
                    SAVE {Math.round((1 - parseFloat(current.displayPrice) / parseFloat(current.strikethroughPrice)) * 100)}%
                  </span>
                )}
              </div>
              {current.urgencyMessage && (
                <p style={{ margin: "5px 0 0", fontSize: 11, color: "#fb923c", display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={11} /> {current.urgencyMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ ...card(), textAlign: "center", padding: 28, color: "#566070", fontSize: 12 }}>
          No upsell product configured yet. Set one up below.
        </div>
      )}

      {/* ── Main grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* ── LEFT: Configure ── */}
        <div style={{ ...card(), display: "flex", flexDirection: "column", gap: 13 }}>
          <p style={secTitle("#c8d0e0")}><Zap size={13} color="#fbbf24" />Configure Upsell</p>

          {/* Product selector */}
          <div>
            <label style={lbl}>Product *</label>
            {productId ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#0f1117", border: "1px solid #1f2330", borderRadius: 6, padding: "6px 10px" }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, border: "1px solid #252836", background: "#13161e", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {productImage ? <img src={productImage} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Package size={14} color="#3a4255" />}
                </div>
                <span style={{ flex: 1, fontSize: 12, color: "#c8d0e0", fontWeight: 600 }}>{productName}</span>
                <button onClick={() => { setProductId(null); setProductName(""); setShowSearch(true); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#566070", display: "flex" }}><X size={13} /></button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#566070" }} />
                <input style={{ ...inp, paddingLeft: 30 }} placeholder="Search products…"
                  value={searchQ}
                  onChange={(e) => { setSearchQ(e.target.value); setShowSearch(true); }}
                  onFocus={() => setShowSearch(true)} />
                {showSearch && searchResults.length > 0 && (
                  <div style={{ position: "absolute", zIndex: 20, top: "calc(100% + 4px)", left: 0, right: 0, background: "#1a1d28", border: "1px solid #252836", borderRadius: 6, maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                    {searchResults.map((p) => (
                      <button key={p.id} onClick={() => selectProduct(p)}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", background: "none", border: "none", cursor: "pointer", textAlign: "left", borderBottom: "1px solid #1f2330" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#252836")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                        <div style={{ width: 28, height: 28, borderRadius: 4, border: "1px solid #252836", background: "#13161e", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Package size={12} color="#3a4255" />}
                        </div>
                        <span style={{ fontSize: 12, color: "#c8d0e0" }}>{p.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prices */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={lbl}>Display Price ($)</label>
              <input style={{ ...inp, color: "#4ade80" }} type="number" step="0.01" placeholder="9.99"
                value={displayPrice} onChange={(e) => setDisplayPrice(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Strikethrough ($)</label>
              <input style={inp} type="number" step="0.01" placeholder="19.99"
                value={strikethroughPrice} onChange={(e) => setStrikethroughPrice(e.target.value)} />
            </div>
          </div>

          {/* Urgency */}
          <div>
            <label style={lbl}>Urgency Message</label>
            <div style={{ position: "relative" }}>
              <Clock size={11} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#fb923c" }} />
              <input style={{ ...inp, paddingLeft: 28, color: "#fb923c" }} placeholder='e.g. "Only 3 left at this price!"'
                value={urgencyMessage} onChange={(e) => setUrgencyMessage(e.target.value)} />
            </div>
          </div>

          {/* Checkbox label */}
          <div>
            <label style={lbl}>Checkbox Label</label>
            <input style={inp} placeholder='e.g. "Yes! Add this to my order"'
              value={checkboxLabel} onChange={(e) => setCheckboxLabel(e.target.value)} />
          </div>

          {/* Save button */}
          <button onClick={save} disabled={!productId || saving}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%",
              background: saved ? "#0a2015" : (!productId || saving) ? "#13161e" : "linear-gradient(135deg, #1e3a8a, #7c3aed)",
              border: `1px solid ${saved ? "#166534" : (!productId || saving) ? "#1f2330" : "#4f46e5"}`,
              color: saved ? "#4ade80" : (!productId || saving) ? "#3a4255" : "#fff",
              borderRadius: 7, padding: "9px 0", fontSize: 12, fontWeight: 700,
              cursor: (!productId || saving) ? "not-allowed" : "pointer",
              transition: "all 0.2s" }}>
            {saved ? <><Check size={13} /> Saved!</> : saving ? "Saving…" : <><Zap size={13} /> Save Upsell Configuration</>}
          </button>
        </div>

        {/* ── RIGHT: Preview + History ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Live Preview */}
          <div style={{ ...card("#4f46e540"), background: "linear-gradient(135deg,#0f111a 0%,#1a1d28 100%)" }}>
            <p style={{ ...secTitle("#a78bfa"), marginBottom: 12 }}><Zap size={13} color="#a78bfa" />Live Preview</p>

            {productId ? (
              <div style={{ background: "#13161e", border: "1px solid #252836", borderRadius: 8, padding: 14 }}>
                <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, color: "#566070", textTransform: "uppercase", letterSpacing: "0.06em" }}>Complete Your Order</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, border: "1px solid #252836", background: "#0f1117", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {productImage ? <img src={productImage} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Package size={20} color="#3a4255" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{productName}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {displayPrice && <span style={{ fontSize: 15, fontWeight: 800, color: "#4ade80" }}>${displayPrice}</span>}
                      {strikethroughPrice && <span style={{ fontSize: 11, color: "#566070", textDecoration: "line-through" }}>${strikethroughPrice}</span>}
                      {savePct > 0 && (
                        <span style={{ fontSize: 9, fontWeight: 700, background: "#7c3aed20", color: "#a78bfa", border: "1px solid #7c3aed40", borderRadius: 3, padding: "1px 5px" }}>
                          -{savePct}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {urgencyMessage && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, background: "#1a1000", border: "1px solid #fb923c30", borderRadius: 5, padding: "5px 8px" }}>
                    <Clock size={10} color="#fb923c" />
                    <span style={{ fontSize: 11, color: "#fb923c" }}>{urgencyMessage}</span>
                  </div>
                )}
                {checkboxLabel && (
                  <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, cursor: "pointer" }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: "#6366f1", border: "1px solid #6366f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Check size={9} color="#fff" />
                    </div>
                    <span style={{ fontSize: 12, color: "#c8d0e0" }}>{checkboxLabel}</span>
                  </label>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "28px 0", color: "#3a4255", fontSize: 12 }}>
                <Package size={28} color="#252836" style={{ margin: "0 auto 8px", display: "block" }} />
                Select a product to see the preview
              </div>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div style={card()}>
              <p style={{ ...secTitle("#8b94a8"), marginBottom: 10 }}><History size={12} color="#566070" />Previous Upsells</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {history.map((h) => (
                  <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#13161e", border: "1px solid #1f2330", borderRadius: 6, padding: "7px 10px" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 5, border: "1px solid #252836", background: "#0f1117", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {h.productImage ? <img src={h.productImage} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Package size={12} color="#3a4255" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#c8d0e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.productName}</p>
                      <p style={{ margin: 0, fontSize: 10, color: "#566070" }}>{new Date(h.createdAt).toLocaleDateString()}{h.displayPrice ? ` · $${h.displayPrice}` : ""}</p>
                    </div>
                    <button onClick={() => quickSwitch(h)}
                      style={{ background: "#1e2a4a", border: "1px solid #2a3a5a", color: "#93c5fd", borderRadius: 5, padding: "3px 9px", fontSize: 10, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                      Use Again
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

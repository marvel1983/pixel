import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Package, Search, Zap, Clock, Tag } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface UpsellConfig {
  id: number; productId: number; isActive: boolean;
  displayPrice: string | null; strikethroughPrice: string | null;
  urgencyMessage: string | null; checkboxLabel: string | null;
  createdAt: string; productName: string; productSlug: string; productImage: string | null;
}
interface Product { id: number; name: string; imageUrl: string | null }

export default function CheckoutUpsellPage() {
  const [active, setActive] = useState<UpsellConfig | null>(null);
  const [history, setHistory] = useState<UpsellConfig[]>([]);
  const [productId, setProductId] = useState<number | null>(null);
  const [productName, setProductName] = useState("");
  const [productImage, setProductImage] = useState<string | null>(null);
  const [displayPrice, setDisplayPrice] = useState("");
  const [strikethroughPrice, setStrikethroughPrice] = useState("");
  const [urgencyMessage, setUrgencyMessage] = useState("");
  const [checkboxLabel, setCheckboxLabel] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchData = useCallback(() => {
    fetch(`${API}/admin/checkout-upsell`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setActive(d.active); setHistory(d.history); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      fetch(`${API}/admin/products?search=${encodeURIComponent(searchQ)}&limit=8`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setSearchResults(d.products?.map((p: Product & { id: number }) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl })) ?? []))
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
    setSaving(true);
    await fetch(`${API}/admin/checkout-upsell`, {
      method: "POST", headers,
      body: JSON.stringify({
        productId, displayPrice: displayPrice || null,
        strikethroughPrice: strikethroughPrice || null,
        urgencyMessage: urgencyMessage || null, checkboxLabel: checkboxLabel || null,
      }),
    });
    setSaving(false); fetchData();
    setProductId(null); setProductName(""); setProductImage(null);
    setDisplayPrice(""); setStrikethroughPrice(""); setUrgencyMessage(""); setCheckboxLabel("");
  };

  const toggle = async (id: number) => {
    await fetch(`${API}/admin/checkout-upsell/${id}/toggle`, { method: "PATCH", headers });
    fetchData();
  };

  const quickSwitch = (cfg: UpsellConfig) => {
    setProductId(cfg.productId); setProductName(cfg.productName); setProductImage(cfg.productImage);
    setDisplayPrice(cfg.displayPrice ?? ""); setStrikethroughPrice(cfg.strikethroughPrice ?? "");
    setUrgencyMessage(cfg.urgencyMessage ?? ""); setCheckboxLabel(cfg.checkboxLabel ?? "");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Checkout Upsell</h1>
        <p className="text-sm text-muted-foreground">Configure the featured product offer shown at checkout</p>
      </div>
      {active ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Current Upsell Product</CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={active.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"} variant="secondary">{active.isActive ? "Active" : "Disabled"}</Badge>
              <Switch checked={active.isActive} onCheckedChange={() => toggle(active.id)} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border bg-gray-50 flex items-center justify-center">
                {active.productImage ? <img src={active.productImage} alt="" className="w-full h-full object-contain rounded-lg" /> : <Package className="h-6 w-6 text-muted-foreground" />}
              </div>
              <div className="flex-1">
                <p className="font-medium">{active.productName}</p>
                <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                  {active.displayPrice && <span>Price: ${active.displayPrice}</span>}
                  {active.strikethroughPrice && <span className="line-through">Was: ${active.strikethroughPrice}</span>}
                </div>
                {active.urgencyMessage && <p className="text-xs text-orange-600 mt-1 flex items-center gap-1"><Clock className="h-3 w-3" />{active.urgencyMessage}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No upsell product configured yet. Set one up below.</CardContent></Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Configure Upsell</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Product</Label>
              <div className="relative mt-1">
                {productId ? (
                  <div className="flex items-center gap-2 rounded-md border p-2">
                    <div className="w-8 h-8 rounded bg-gray-50 border flex items-center justify-center">
                      {productImage ? <img src={productImage} alt="" className="w-full h-full object-contain rounded" /> : <Package className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <span className="flex-1 text-sm font-medium">{productName}</span>
                    <Button variant="ghost" size="sm" onClick={() => { setProductId(null); setProductName(""); setShowSearch(true); }}>Change</Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search products..." value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setShowSearch(true); }} onFocus={() => setShowSearch(true)} className="pl-9" />
                  </div>
                )}
                {showSearch && searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map((p) => (
                      <button key={p.id} className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => selectProduct(p)}>
                        <div className="w-8 h-8 rounded bg-gray-50 border flex items-center justify-center shrink-0">
                          {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-contain rounded" /> : <Package className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Display Price ($)</Label><Input type="number" step="0.01" placeholder="e.g. 9.99" value={displayPrice} onChange={(e) => setDisplayPrice(e.target.value)} className="mt-1" /></div>
              <div><Label>Strikethrough Price ($)</Label><Input type="number" step="0.01" placeholder="e.g. 19.99" value={strikethroughPrice} onChange={(e) => setStrikethroughPrice(e.target.value)} className="mt-1" /></div>
            </div>
            <div><Label>Urgency Message</Label><Input placeholder='e.g. "Only 3 left at this price!"' value={urgencyMessage} onChange={(e) => setUrgencyMessage(e.target.value)} className="mt-1" /></div>
            <div><Label>Checkbox Label</Label><Input placeholder='e.g. "Add to my order"' value={checkboxLabel} onChange={(e) => setCheckboxLabel(e.target.value)} className="mt-1" /></div>
            <Button onClick={save} disabled={!productId || saving} className="w-full">{saving ? "Saving..." : "Save Upsell Configuration"}</Button>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" />Live Preview</CardTitle></CardHeader>
            <CardContent>
              {productId ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                  <h4 className="text-sm font-semibold mb-3">Complete Your Order</h4>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded bg-white border flex items-center justify-center shrink-0">
                      {productImage ? <img src={productImage} alt="" className="w-full h-full object-contain rounded" /> : <Package className="h-5 w-5 text-muted-foreground/40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{productName}</p>
                      <div className="flex items-center gap-2">
                        {displayPrice && <span className="text-sm font-bold text-green-700">${displayPrice}</span>}
                        {strikethroughPrice && <span className="text-xs text-muted-foreground line-through">${strikethroughPrice}</span>}
                      </div>
                    </div>
                  </div>
                  {urgencyMessage && <p className="text-xs text-orange-600 mt-2 flex items-center gap-1"><Clock className="h-3 w-3" />{urgencyMessage}</p>}
                  {checkboxLabel && (
                    <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300" defaultChecked />{checkboxLabel}
                    </label>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">Select a product to see the preview</div>
              )}
            </CardContent>
          </Card>
          {history.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4" />Previous Upsell Products</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 rounded-md border p-2">
                    <div className="w-8 h-8 rounded bg-gray-50 border flex items-center justify-center shrink-0">
                      {h.productImage ? <img src={h.productImage} alt="" className="w-full h-full object-contain rounded" /> : <Package className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{h.productName}</p>
                      <p className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => quickSwitch(h)}>Use Again</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

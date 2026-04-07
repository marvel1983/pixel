import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Zap, Plus, Pencil, Copy, Trash2, BarChart3, Loader2, ArrowLeft } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface FlashSaleRow { id: number; name: string; slug: string; status: string; isActive: boolean; startsAt: string; endsAt: string; bannerText: string; bannerColor: string; productCount: number; totalSold: number; createdAt: string }
interface AnalyticsProduct { variantId: number; productName: string; variantName: string; salePriceUsd: string; originalPriceUsd: string; maxQuantity: number; soldCount: number; revenue: string }
type View = { type: "list" } | { type: "edit"; id: number } | { type: "analytics"; id: number; name: string };

export default function AdminFlashSalesPage() {
  const token = useAuthStore((s) => s.token);
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const { toast } = useToast();
  const [sales, setSales] = useState<FlashSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ type: "list" });

  const fetchSales = () => {
    fetch(`${API}/admin/flash-sales`, { headers })
      .then((r) => r.json()).then(setSales)
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(fetchSales, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this flash sale?")) return;
    await fetch(`${API}/admin/flash-sales/${id}`, { method: "DELETE", headers });
    toast({ title: "Deleted" }); fetchSales();
  };

  const handleDuplicate = async (id: number) => {
    await fetch(`${API}/admin/flash-sales/${id}/duplicate`, { method: "POST", headers });
    toast({ title: "Duplicated" }); fetchSales();
  };

  if (view.type === "edit") {
    return <FlashSaleForm id={view.id} token={token!} onDone={() => { setView({ type: "list" }); fetchSales(); }} />;
  }

  if (view.type === "analytics") {
    return <FlashSaleAnalytics id={view.id} name={view.name} token={token!} onBack={() => setView({ type: "list" })} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6 text-red-500" /> Flash Sales
        </h1>
        <Button onClick={() => setView({ type: "edit", id: 0 })}><Plus className="h-4 w-4 mr-1" /> New Flash Sale</Button>
      </div>
      {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : (
        <div className="space-y-3">
          {sales.length === 0 && <p className="text-center text-muted-foreground py-8">No flash sales yet.</p>}
          {sales.map((s) => {
            const isLive = s.status === "ACTIVE" && s.isActive && new Date(s.endsAt) > new Date();
            return (
              <Card key={s.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold truncate">{s.name}</span>
                      <Badge variant={isLive ? "default" : "secondary"} className={isLive ? "bg-green-500" : ""}>
                        {isLive ? "LIVE" : s.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-x-3">
                      <span>{new Date(s.startsAt).toLocaleDateString()} — {new Date(s.endsAt).toLocaleDateString()}</span>
                      <span>{s.productCount} products</span>
                      <span>{s.totalSold} sold</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" title="Analytics" onClick={() => setView({ type: "analytics", id: s.id, name: s.name })}><BarChart3 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setView({ type: "edit", id: s.id })}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDuplicate(s.id)}><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface AnalyticsProps { id: number; name: string; token: string; onBack: () => void }

function FlashSaleAnalytics({ id, name, token, onBack }: AnalyticsProps) {
  const [products, setProducts] = useState<AnalyticsProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/admin/flash-sales/${id}/analytics`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setProducts(d.items || d.products || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const totalRevenue = products.reduce((s, p) => s + parseFloat(p.revenue || "0"), 0);
  const totalSold = products.reduce((s, p) => s + p.soldCount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h1 className="text-xl font-bold flex items-center gap-2"><BarChart3 className="h-5 w-5" /> {name} — Analytics</h1>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Total Sold</p><p className="text-2xl font-bold">{totalSold}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p></CardContent></Card>
      </div>
      {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : products.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No products in this flash sale.</p>
      ) : (
        <Card>
          <CardHeader><CardTitle>Product Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left">
                  <th className="pb-2">Product</th><th className="pb-2">Sale Price</th>
                  <th className="pb-2">Original</th><th className="pb-2">Sold</th>
                  <th className="pb-2">Stock</th><th className="pb-2">Revenue</th>
                </tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.variantId} className="border-b">
                      <td className="py-2">{p.productName}<br /><span className="text-xs text-muted-foreground">{p.variantName}</span></td>
                      <td className="py-2 text-red-600 font-medium">${p.salePriceUsd}</td>
                      <td className="py-2 text-muted-foreground line-through">${p.originalPriceUsd}</td>
                      <td className="py-2 font-medium">{p.soldCount}</td>
                      <td className="py-2">{p.soldCount}/{p.maxQuantity}</td>
                      <td className="py-2 font-medium">${parseFloat(p.revenue || "0").toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ProductVariant { productId: number; variantId: number; productName: string; variantName: string; priceUsd: string; image: string }
interface SaleProduct { productId: number; variantId: number; salePriceUsd: string; maxQuantity: number; sortOrder: number }
interface FormProps { id: number; token: string; onDone: () => void }

function FlashSaleForm({ id, token, onDone }: FormProps) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const { toast } = useToast();
  const isNew = id === 0;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", description: "", status: "DRAFT" as string,
    startsAt: "", endsAt: "", bannerText: "", bannerColor: "#ef4444", isActive: true,
  });
  const [saleProducts, setSaleProducts] = useState<SaleProduct[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  useEffect(() => {
    fetch(`${API}/admin/products?limit=500`, { headers }).then((r) => r.json())
      .then((d) => {
        const rows = d.products || d || [];
        const vs: ProductVariant[] = [];
        rows.forEach((p: { id: number; name: string; imageUrl: string; variants?: { id: number; name: string; priceUsd: string }[] }) => {
          (p.variants || []).forEach((v) => {
            vs.push({ productId: p.id, variantId: v.id, productName: p.name, variantName: v.name, priceUsd: v.priceUsd, image: p.imageUrl });
          });
        });
        setVariants(vs);
      }).catch(() => {});
    if (!isNew) {
      fetch(`${API}/admin/flash-sales/${id}`, { headers }).then((r) => r.json())
        .then((d) => {
          setForm({
            name: d.name, slug: d.slug, description: d.description || "",
            status: d.status, startsAt: d.startsAt?.slice(0, 16) || "", endsAt: d.endsAt?.slice(0, 16) || "",
            bannerText: d.bannerText || "", bannerColor: d.bannerColor || "#ef4444", isActive: d.isActive,
          });
          setSaleProducts(d.products?.map((p: SaleProduct) => ({
            productId: p.productId, variantId: p.variantId, salePriceUsd: p.salePriceUsd,
            maxQuantity: p.maxQuantity, sortOrder: p.sortOrder,
          })) || []);
        }).catch(() => {});
    }
  }, [id]);

  const update = (f: string, v: string | boolean) => setForm((p) => ({ ...p, [f]: v }));

  const addProduct = (variantId: number) => {
    const v = variants.find((x) => x.variantId === variantId);
    if (!v || saleProducts.some((sp) => sp.variantId === variantId)) return;
    setSaleProducts((p) => [...p, {
      productId: v.productId, variantId, salePriceUsd: v.priceUsd, maxQuantity: 100, sortOrder: p.length,
    }]);
  };

  const handleSave = async () => {
    if (!form.name || !form.slug || !form.startsAt || !form.endsAt) {
      toast({ title: "Fill required fields", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const body = { ...form, products: saleProducts };
      const url = isNew ? `${API}/admin/flash-sales` : `${API}/admin/flash-sales/${id}`;
      const method = isNew ? "POST" : "PUT";
      const r = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: isNew ? "Created" : "Updated" }); onDone();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onDone}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h1 className="text-xl font-bold">{isNew ? "New Flash Sale" : "Edit Flash Sale"}</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => update("name", e.target.value)} /></div>
            <div><Label>Slug *</Label><Input value={form.slug} onChange={(e) => update("slug", e.target.value)} /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => update("description", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Starts At *</Label><Input type="datetime-local" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} /></div>
              <div><Label>Ends At *</Label><Input type="datetime-local" value={form.endsAt} onChange={(e) => update("endsAt", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.status} onChange={(e) => update("status", e.target.value)}>
                  <option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="ENDED">Ended</option>
                </select>
              </div>
              <div><Label>Banner Color</Label><Input type="color" value={form.bannerColor} onChange={(e) => update("bannerColor", e.target.value)} /></div>
            </div>
            <div><Label>Banner Text</Label><Input value={form.bannerText} onChange={(e) => update("bannerText", e.target.value)} placeholder="Custom banner text" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Products ({saleProducts.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <select className="w-full border rounded px-2 py-1.5 text-sm" onChange={(e) => { addProduct(parseInt(e.target.value)); e.target.value = ""; }}>
              <option value="">Add product variant...</option>
              {variants.filter((v) => !saleProducts.some((sp) => sp.variantId === v.variantId)).map((v) => (
                <option key={v.variantId} value={v.variantId}>{v.productName} — {v.variantName} (${v.priceUsd})</option>
              ))}
            </select>
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {saleProducts.map((sp, i) => {
                const v = variants.find((x) => x.variantId === sp.variantId);
                return (
                  <div key={sp.variantId} className="flex items-center gap-2 p-2 border rounded text-sm">
                    <span className="flex-1 truncate text-xs">{v?.productName} — {v?.variantName}</span>
                    <Input className="w-24 h-7 text-xs" type="number" step="0.01" value={sp.salePriceUsd}
                      onChange={(e) => { const u = [...saleProducts]; u[i] = { ...u[i], salePriceUsd: e.target.value }; setSaleProducts(u); }} />
                    <Input className="w-16 h-7 text-xs" type="number" value={sp.maxQuantity}
                      onChange={(e) => { const u = [...saleProducts]; u[i] = { ...u[i], maxQuantity: parseInt(e.target.value) || 1 }; setSaleProducts(u); }} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSaleProducts((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Saving...</> : "Save Flash Sale"}
        </Button>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Zap, Plus, Pencil, Copy, Trash2, BarChart3, Loader2, ArrowLeft } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface FlashSaleRow { id: number; name: string; slug: string; status: string; isActive: boolean; startsAt: string; endsAt: string; bannerText: string; bannerColor: string; productCount: number; totalSold: number; createdAt: string }
interface AnalyticsProduct { variantId: number; productName: string; variantName: string; salePriceUsd: string; originalPriceUsd: string; maxQuantity: number; soldCount: number; revenue: string }
type View = { type: "list" } | { type: "edit"; id: number } | { type: "analytics"; id: number; name: string };

const thBase = "border-b border-r border-[#2a2e3a] bg-[#1e2128] px-2.5 py-[8px] text-[10.5px] font-bold uppercase tracking-widest select-none whitespace-nowrap card-title";
const tableCell = "border-b border-r border-[#1f2840] px-2.5 py-[6px] align-middle text-[12.5px] leading-none text-[#dde4f0]";

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
    <div className="space-y-3 text-[#e8edf5]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-400" /> Flash Sales
        </h1>
        <Button className="bg-sky-600 hover:bg-sky-700 text-white" onClick={() => setView({ type: "edit", id: 0 })}><Plus className="h-4 w-4 mr-1" /> New Flash Sale</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#8fa0bb]" /></div>
      ) : (
        <div className="space-y-2">
          {sales.length === 0 && <p className="text-center text-[#8fa0bb] py-8 text-[13px]">No flash sales yet.</p>}
          {sales.map((s) => {
            const isLive = s.status === "ACTIVE" && s.isActive && new Date(s.endsAt) > new Date();
            return (
              <div key={s.id} className="rounded-lg border border-[#2e3340] bg-[#181c24] p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-[#dde4f0] truncate">{s.name}</span>
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold ${isLive ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-[#3d4558] bg-[#1a1f2e] text-[#8fa0bb]"}`}>
                      {isLive ? "LIVE" : s.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#8fa0bb] space-x-3">
                    <span>{new Date(s.startsAt).toLocaleDateString()} — {new Date(s.endsAt).toLocaleDateString()}</span>
                    <span>{s.productCount} products</span>
                    <span>{s.totalSold} sold</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" title="Analytics" className="h-8 w-8 text-[#8fa0bb] hover:text-sky-400 hover:bg-[#1e2a40]" onClick={() => setView({ type: "analytics", id: s.id, name: s.name })}><BarChart3 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-[#8fa0bb] hover:text-white hover:bg-[#1e2a40]" onClick={() => setView({ type: "edit", id: s.id })}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-[#8fa0bb] hover:text-white hover:bg-[#1e2a40]" onClick={() => handleDuplicate(s.id)}><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-200 hover:bg-red-500/10" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
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
    <div className="space-y-3 text-[#e8edf5]">
      <div className="flex items-center gap-2">
        <Button variant="ghost" className="text-[#8fa0bb] hover:text-white" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h1 className="text-xl font-bold text-white flex items-center gap-2"><BarChart3 className="h-5 w-5" /> {name} — Analytics</h1>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[#2e3340] bg-[#181c24] p-4 text-center">
          <p className="text-[11px] text-[#8fa0bb] uppercase tracking-wider mb-1">Total Sold</p>
          <p className="text-2xl font-bold text-white">{totalSold}</p>
        </div>
        <div className="rounded-lg border border-[#2e3340] bg-[#181c24] p-4 text-center">
          <p className="text-[11px] text-[#8fa0bb] uppercase tracking-wider mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-white">${totalRevenue.toFixed(2)}</p>
        </div>
      </div>
      {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#8fa0bb]" /> : products.length === 0 ? (
        <p className="text-center text-[#8fa0bb] py-8 text-[13px]">No products in this flash sale.</p>
      ) : (
        <div className="rounded-lg border border-[#2e3340] bg-[#181c24]">
          <div className="border-b border-[#2a2e3a] px-4 py-3 bg-[#1e2128]">
            <p className="card-title text-[13px] font-bold uppercase tracking-widest">Product Performance</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left" style={{ borderSpacing: 0 }}>
              <thead>
                <tr className="border-b-2 border-[#2a2e3a]" style={{ backgroundColor: "#1e2128" }}>
                  <th className={thBase}>Product</th>
                  <th className={thBase}>Sale Price</th>
                  <th className={thBase}>Original</th>
                  <th className={thBase}>Sold</th>
                  <th className={thBase}>Stock</th>
                  <th className={`${thBase} border-r-0`}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, idx) => (
                  <tr key={p.variantId} className={`transition-colors duration-75 ${idx % 2 === 0 ? "bg-[#0c1018] hover:bg-[#111825]" : "bg-[#0f1520] hover:bg-[#141e2e]"}`}>
                    <td className={tableCell}>
                      {p.productName}
                      <br /><span className="text-[11px] text-[#8fa0bb]">{p.variantName}</span>
                    </td>
                    <td className={`${tableCell} text-red-300 font-medium`}>${p.salePriceUsd}</td>
                    <td className={`${tableCell} text-[#8fa0bb] line-through`}>${p.originalPriceUsd}</td>
                    <td className={`${tableCell} font-medium text-white`}>{p.soldCount}</td>
                    <td className={`${tableCell} text-[#8fa0bb]`}>{p.soldCount}/{p.maxQuantity}</td>
                    <td className={`${tableCell} font-medium text-white border-r-0`}>${parseFloat(p.revenue || "0").toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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

  const inputCls = "border-[#3d4558] bg-[#0f1117] text-[#e8edf5] placeholder:text-[#6b7280] focus-visible:ring-sky-500/40 focus-visible:border-sky-500/60";
  const labelCls = "text-[11px] font-semibold uppercase tracking-wider text-[#8fa0bb]";

  return (
    <div className="space-y-4 text-[#e8edf5]">
      <div className="flex items-center gap-2">
        <Button variant="ghost" className="text-[#8fa0bb] hover:text-white" onClick={onDone}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h1 className="text-xl font-bold text-white">{isNew ? "New Flash Sale" : "Edit Flash Sale"}</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[#2e3340] bg-[#181c24]">
          <div className="border-b border-[#2a2e3a] px-4 py-3 bg-[#1e2128]">
            <p className="card-title text-[13px] font-bold uppercase tracking-widest">Details</p>
          </div>
          <div className="p-4 space-y-3">
            <div><Label className={labelCls}>Name *</Label><Input className={inputCls} value={form.name} onChange={(e) => update("name", e.target.value)} /></div>
            <div><Label className={labelCls}>Slug *</Label><Input className={inputCls} value={form.slug} onChange={(e) => update("slug", e.target.value)} /></div>
            <div><Label className={labelCls}>Description</Label><Input className={inputCls} value={form.description} onChange={(e) => update("description", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className={labelCls}>Starts At *</Label><Input type="datetime-local" className={inputCls} value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} /></div>
              <div><Label className={labelCls}>Ends At *</Label><Input type="datetime-local" className={inputCls} value={form.endsAt} onChange={(e) => update("endsAt", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className={labelCls}>Status</Label>
                <select className="w-full h-9 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-sm text-[#e8edf5]" value={form.status} onChange={(e) => update("status", e.target.value)}>
                  <option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="ENDED">Ended</option>
                </select>
              </div>
              <div><Label className={labelCls}>Banner Color</Label><Input type="color" className={inputCls} value={form.bannerColor} onChange={(e) => update("bannerColor", e.target.value)} /></div>
            </div>
            <div><Label className={labelCls}>Banner Text</Label><Input className={inputCls} value={form.bannerText} onChange={(e) => update("bannerText", e.target.value)} placeholder="Custom banner text" /></div>
          </div>
        </div>
        <div className="rounded-lg border border-[#2e3340] bg-[#181c24]">
          <div className="border-b border-[#2a2e3a] px-4 py-3 bg-[#1e2128]">
            <p className="card-title text-[13px] font-bold uppercase tracking-widest">Products ({saleProducts.length})</p>
          </div>
          <div className="p-4 space-y-3">
            <select className="w-full h-9 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-sm text-[#e8edf5]" onChange={(e) => { addProduct(parseInt(e.target.value)); e.target.value = ""; }}>
              <option value="">Add product variant...</option>
              {variants.filter((v) => !saleProducts.some((sp) => sp.variantId === v.variantId)).map((v) => (
                <option key={v.variantId} value={v.variantId}>{v.productName} — {v.variantName} (${v.priceUsd})</option>
              ))}
            </select>
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {saleProducts.map((sp, i) => {
                const v = variants.find((x) => x.variantId === sp.variantId);
                return (
                  <div key={sp.variantId} className="flex items-center gap-2 p-2 rounded border border-[#2e3340] bg-[#0f1520] text-sm">
                    <span className="flex-1 truncate text-[11px] text-[#dde4f0]">{v?.productName} — {v?.variantName}</span>
                    <Input className={`w-24 h-7 text-xs ${inputCls}`} type="number" step="0.01" value={sp.salePriceUsd}
                      onChange={(e) => { const u = [...saleProducts]; u[i] = { ...u[i], salePriceUsd: e.target.value }; setSaleProducts(u); }} />
                    <Input className={`w-16 h-7 text-xs ${inputCls}`} type="number" value={sp.maxQuantity}
                      onChange={(e) => { const u = [...saleProducts]; u[i] = { ...u[i], maxQuantity: parseInt(e.target.value) || 1 }; setSaleProducts(u); }} />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-200 hover:bg-red-500/10" onClick={() => setSaleProducts((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button className="bg-sky-600 hover:bg-sky-700 text-white" onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Saving...</> : "Save Flash Sale"}
        </Button>
        <Button variant="outline" className="border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5]" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

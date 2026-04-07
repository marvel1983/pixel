import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Zap, Plus, Pencil, Copy, Trash2, BarChart3, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface FlashSaleRow {
  id: number; name: string; slug: string; status: string;
  isActive: boolean; startsAt: string; endsAt: string;
  bannerText: string; bannerColor: string;
  productCount: number; totalSold: number; createdAt: string;
}

export default function AdminFlashSalesPage() {
  const token = useAuthStore((s) => s.token);
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const { toast } = useToast();
  const [sales, setSales] = useState<FlashSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);

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

  if (editId !== null) {
    return <FlashSaleForm id={editId} token={token!} onDone={() => { setEditId(null); fetchSales(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6 text-red-500" /> Flash Sales
        </h1>
        <Button onClick={() => setEditId(0)}><Plus className="h-4 w-4 mr-1" /> New Flash Sale</Button>
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
                    <Button variant="ghost" size="icon" onClick={() => setEditId(s.id)}><Pencil className="h-4 w-4" /></Button>
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
  const [saleProducts, setSaleProducts] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/admin/products?limit=500`, { headers }).then((r) => r.json())
      .then((d) => {
        const rows = (d.products || d || []);
        const vs: any[] = [];
        rows.forEach((p: any) => {
          (p.variants || []).forEach((v: any) => {
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
          setSaleProducts(d.products?.map((p: any) => ({
            productId: p.productId, variantId: p.variantId, salePriceUsd: p.salePriceUsd,
            maxQuantity: p.maxQuantity, sortOrder: p.sortOrder,
          })) || []);
        }).catch(() => {});
    }
  }, [id]);

  const update = (f: string, v: any) => setForm((p) => ({ ...p, [f]: v }));

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
        <Button variant="ghost" onClick={onDone}>← Back</Button>
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

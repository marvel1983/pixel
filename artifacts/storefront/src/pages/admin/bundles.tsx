import { useState, useEffect, useCallback } from "react";
import { Package, Plus, Search, Copy, Trash2, Pencil, Star, Tag, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Skeleton } from "@/components/ui/skeleton";

const API = import.meta.env.VITE_API_URL ?? "/api";

const inputCls = "w-full rounded border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const labelCls = "block text-[11.5px] font-medium text-[#8fa0bb] mb-1";

interface BundleProduct { productId: number; productName: string; productImage: string | null; sortOrder: number; }
interface AdminBundle {
  id: number; name: string; slug: string; bundlePriceUsd: string;
  isActive: boolean; isFeatured: boolean; createdAt: string;
  shortDescription: string | null; description: string | null;
  imageUrl: string | null; metaTitle: string | null; metaDescription: string | null;
  sortOrder: number; items: BundleProduct[];
  productIds?: number[];
}

interface ProductOption { id: number; name: string; imageUrl: string | null; }
interface BundleAnalytics { bundleId: number; name: string; itemCount: number; purchases: number; revenue: string; }

export default function AdminBundlesPage() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [bundles, setBundles] = useState<AdminBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminBundle | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [analytics, setAnalytics] = useState<BundleAnalytics | null>(null);

  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API}/admin/bundles?search=${search}`, { headers: h });
    const data = await r.json();
    setBundles(data.bundles || []);
    setLoading(false);
  }, [search, token]);

  useEffect(() => { load(); }, [load]);

  async function loadProducts() {
    const r = await fetch(`${API}/admin/products?limit=200`, { headers: h });
    const data = await r.json();
    setProducts((data.products || []).map((p: ProductOption) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl })));
  }

  function openNew() {
    setEditing({ id: 0, name: "", slug: "", bundlePriceUsd: "0", isActive: true, isFeatured: false, createdAt: "", shortDescription: null, description: null, imageUrl: null, metaTitle: null, metaDescription: null, sortOrder: 0, items: [] });
    setSelectedIds([]);
    loadProducts();
    setOpen(true);
  }

  function openEdit(b: AdminBundle) {
    setEditing(b);
    setSelectedIds(b.items.map((i) => i.productId));
    loadProducts();
    setOpen(true);
  }

  async function save() {
    if (!editing || selectedIds.length < 2) { toast({ title: "Select at least 2 products", variant: "destructive" }); return; }
    setSaving(true);
    const body = {
      name: editing.name, slug: editing.slug, description: editing.description,
      shortDescription: editing.shortDescription, imageUrl: editing.imageUrl,
      bundlePriceUsd: editing.bundlePriceUsd, isActive: editing.isActive,
      isFeatured: editing.isFeatured, metaTitle: editing.metaTitle,
      metaDescription: editing.metaDescription, sortOrder: editing.sortOrder,
      productIds: selectedIds,
    };
    const url = editing.id ? `${API}/admin/bundles/${editing.id}` : `${API}/admin/bundles`;
    const r = await fetch(url, { method: editing.id ? "PUT" : "POST", headers: h, body: JSON.stringify(body) });
    if (r.ok) { toast({ title: editing.id ? "Bundle updated" : "Bundle created" }); setOpen(false); load(); }
    else { const e = await r.json(); toast({ title: e.error || "Error", variant: "destructive" }); }
    setSaving(false);
  }

  async function remove(id: number) {
    if (!confirm("Delete this bundle?")) return;
    await fetch(`${API}/admin/bundles/${id}`, { method: "DELETE", headers: h });
    toast({ title: "Bundle deleted" }); load();
  }

  async function duplicate(id: number) {
    await fetch(`${API}/admin/bundles/${id}/duplicate`, { method: "POST", headers: h });
    toast({ title: "Bundle duplicated" }); load();
  }

  async function viewAnalytics(id: number) {
    const r = await fetch(`${API}/admin/bundles/${id}/analytics`, { headers: h });
    if (r.ok) setAnalytics(await r.json());
  }

  function toggleProduct(id: number) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function moveProduct(idx: number, dir: -1 | 1) {
    setSelectedIds((prev) => {
      const arr = [...prev];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return arr;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }

  const filteredProducts = products.filter((p) =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Bundles</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded border border-sky-500 bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
        >
          <Plus className="h-4 w-4" /> Create Bundle
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5a6a84]" />
          <input
            className="w-full rounded border border-[#2e3340] bg-[#0f1117] pl-9 pr-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
            placeholder="Search bundles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-[#2e3340] bg-[#181c24] overflow-hidden" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
        <table className="w-full">
          <thead>
            <tr className="bg-[#1e2128]">
              <th className="px-3 py-[8px] text-[10.5px] font-bold uppercase tracking-widest border-b border-[#2a2e3a] text-left">Bundle</th>
              <th className="px-3 py-[8px] text-[10.5px] font-bold uppercase tracking-widest border-b border-[#2a2e3a] text-left">Products</th>
              <th className="px-3 py-[8px] text-[10.5px] font-bold uppercase tracking-widest border-b border-[#2a2e3a] text-left">Price</th>
              <th className="px-3 py-[8px] text-[10.5px] font-bold uppercase tracking-widest border-b border-[#2a2e3a] text-left">Status</th>
              <th className="px-3 py-[8px] text-[10.5px] font-bold uppercase tracking-widest border-b border-[#2a2e3a] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="bg-[#0c1018]"><td colSpan={5} className="px-3 py-[6px] border-b border-[#1f2840]"><Skeleton className="h-8 w-full" /></td></tr>
            )) : bundles.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-[6px] text-[12.5px] text-[#5a6a84] text-center py-8">No bundles found</td></tr>
            ) : bundles.map((b, i) => (
              <tr key={b.id} className={`${i % 2 === 0 ? "bg-[#0c1018]" : "bg-[#0f1520]"} hover:bg-[#111825]`}>
                <td className="px-3 py-[6px] text-[12.5px] text-[#dde4f0] border-b border-[#1f2840]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-[#1e2128] flex items-center justify-center">
                      {b.imageUrl ? <img src={b.imageUrl} className="w-full h-full object-cover rounded" /> : <Package className="h-5 w-5 text-[#5a6a84]" />}
                    </div>
                    <div>
                      <p className="font-medium text-[#dde4f0]">{b.name}</p>
                      <p className="text-xs text-[#5a6a84]">/{b.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-[6px] text-[12.5px] text-[#dde4f0] border-b border-[#1f2840]"><Badge variant="secondary">{b.items.length} products</Badge></td>
                <td className="px-3 py-[6px] text-[12.5px] text-[#dde4f0] border-b border-[#1f2840] font-medium">${b.bundlePriceUsd}</td>
                <td className="px-3 py-[6px] text-[12.5px] text-[#dde4f0] border-b border-[#1f2840]">
                  <div className="flex gap-1">
                    {b.isActive ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="secondary">Draft</Badge>}
                    {b.isFeatured && <Badge className="bg-amber-100 text-amber-800">Featured</Badge>}
                  </div>
                </td>
                <td className="px-3 py-[6px] text-[12.5px] text-[#dde4f0] border-b border-[#1f2840] text-right">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => viewAnalytics(b.id)} title="Analytics"><BarChart3 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => duplicate(b.id)}><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {analytics && (
        <Dialog open={!!analytics} onOpenChange={() => setAnalytics(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Bundle Analytics</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <p className="font-medium text-[#dde4f0]">{analytics.name}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[#2e3340] bg-[#0f1117] p-3 text-center">
                  <p className="text-2xl font-bold text-[#dde4f0]">{analytics.purchases}</p>
                  <p className="text-xs text-[#5a6a84]">Orders</p>
                </div>
                <div className="rounded-lg border border-[#2e3340] bg-[#0f1117] p-3 text-center">
                  <p className="text-2xl font-bold text-[#dde4f0]">${analytics.revenue}</p>
                  <p className="text-xs text-[#5a6a84]">Revenue</p>
                </div>
              </div>
              <p className="text-xs text-[#5a6a84]">{analytics.itemCount} products in bundle</p>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <BundleDialog
        open={open} onOpenChange={setOpen} editing={editing} setEditing={setEditing}
        saving={saving} onSave={save} selectedIds={selectedIds}
        toggleProduct={toggleProduct} moveProduct={moveProduct}
        products={filteredProducts} productSearch={productSearch}
        setProductSearch={setProductSearch}
      />
    </div>
  );
}

function BundleDialog({ open, onOpenChange, editing, setEditing, saving, onSave, selectedIds, toggleProduct, moveProduct, products, productSearch, setProductSearch }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: AdminBundle | null;
  setEditing: (b: AdminBundle | null) => void; saving: boolean; onSave: () => void;
  selectedIds: number[]; toggleProduct: (id: number) => void;
  moveProduct: (idx: number, dir: -1 | 1) => void; products: ProductOption[];
  productSearch: string; setProductSearch: (v: string) => void;
}) {
  if (!editing) return null;
  const upd = (field: keyof AdminBundle, val: string | number | boolean | null) => setEditing({ ...editing, [field]: val });

  const bundlePrice = parseFloat(editing.bundlePriceUsd) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing.id ? "Edit" : "Create"} Bundle</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Name</label><input className={inputCls} value={editing.name} onChange={(e) => upd("name", e.target.value)} /></div>
            <div><label className={labelCls}>Slug</label><input className={inputCls} value={editing.slug} onChange={(e) => upd("slug", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Bundle Price (USD)</label><input className={inputCls} type="number" step="0.01" value={editing.bundlePriceUsd} onChange={(e) => upd("bundlePriceUsd", e.target.value)} /></div>
            <div><label className={labelCls}>Sort Order</label><input className={inputCls} type="number" value={editing.sortOrder} onChange={(e) => upd("sortOrder", parseInt(e.target.value) || 0)} /></div>
          </div>
          {selectedIds.length >= 2 && bundlePrice > 0 && (
            <div className="p-3 bg-green-950/30 border border-green-800 rounded text-sm flex items-center gap-2">
              <Tag className="h-4 w-4 text-green-400" />
              <span className="text-green-300">Bundle: <strong>{selectedIds.length} products</strong> at <strong>${bundlePrice.toFixed(2)}</strong>. Savings auto-calculated from individual product prices on storefront.</span>
            </div>
          )}
          <div><label className={labelCls}>Short Description</label><input className={inputCls} value={editing.shortDescription ?? ""} onChange={(e) => upd("shortDescription", e.target.value)} /></div>
          <div><label className={labelCls}>Description</label><Textarea rows={3} value={editing.description ?? ""} onChange={(e) => upd("description", e.target.value)} /></div>
          <div><label className={labelCls}>Image URL</label><input className={inputCls} value={editing.imageUrl ?? ""} onChange={(e) => upd("imageUrl", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>SEO Title</label><input className={inputCls} value={editing.metaTitle ?? ""} onChange={(e) => upd("metaTitle", e.target.value)} /></div>
            <div><label className={labelCls}>SEO Description</label><input className={inputCls} value={editing.metaDescription ?? ""} onChange={(e) => upd("metaDescription", e.target.value)} /></div>
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-2"><Switch checked={editing.isActive} onCheckedChange={(v) => upd("isActive", v)} /><label className={labelCls + " mb-0"}>Active</label></div>
            <div className="flex items-center gap-2"><Switch checked={editing.isFeatured} onCheckedChange={(v) => upd("isFeatured", v)} /><label className={labelCls + " mb-0"}>Featured</label></div>
          </div>
          <div className="border-t border-[#2a2e3a] pt-4">
            <label className={labelCls + " mb-2"}>Products in Bundle ({selectedIds.length} selected)</label>
            {selectedIds.length > 0 && (
              <div className="space-y-1 mb-3 p-2 bg-[#0f1117] rounded border border-[#2e3340]">
                {selectedIds.map((id, i) => {
                  const p = products.find((x) => x.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-[#dde4f0]">{i + 1}. {p?.name || `Product #${id}`}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => moveProduct(i, -1)} disabled={i === 0}>↑</Button>
                        <Button variant="ghost" size="sm" onClick={() => moveProduct(i, 1)} disabled={i === selectedIds.length - 1}>↓</Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleProduct(id)}>✕</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <input className={inputCls + " mb-2"} placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
            <div className="max-h-40 overflow-y-auto border border-[#2e3340] rounded p-1 space-y-0.5 bg-[#0f1117]">
              {products.filter((p) => !selectedIds.includes(p.id)).map((p) => (
                <div key={p.id} onClick={() => toggleProduct(p.id)} className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-[#1e2128] text-sm text-[#dde4f0]">
                  <Package className="h-4 w-4 text-[#5a6a84]" /> {p.name}
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save Bundle"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DarkCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
      <div className="border-b border-[#2a2e3a] px-4 py-3 bg-[#1e2128]">
        <p className="card-title text-[13px] font-bold uppercase tracking-widest">{title}</p>
        {description && <p className="mt-0.5 text-[11px] text-[#5a6a84]">{description}</p>}
      </div>
      <div className="px-4 py-4 space-y-4">{children}</div>
    </div>
  );
}

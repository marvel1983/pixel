import { useState, useEffect, useCallback } from "react";
import { Package, Plus, Search, Copy, Trash2, Pencil, Eye, EyeOff, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Skeleton } from "@/components/ui/skeleton";

const API = import.meta.env.VITE_API_URL ?? "/api";

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
    setProducts((data.products || []).map((p: any) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl })));
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
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Create Bundle</Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search bundles..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bundle</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            )) : bundles.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No bundles found</TableCell></TableRow>
            ) : bundles.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      {b.imageUrl ? <img src={b.imageUrl} className="w-full h-full object-cover rounded" /> : <Package className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">/{b.slug}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary">{b.items.length} products</Badge></TableCell>
                <TableCell className="font-medium">${b.bundlePriceUsd}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {b.isActive ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="secondary">Draft</Badge>}
                    {b.isFeatured && <Badge className="bg-amber-100 text-amber-800">Featured</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => duplicate(b.id)}><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

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
  const upd = (field: string, val: any) => setEditing({ ...editing, [field]: val });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing.id ? "Edit" : "Create"} Bundle</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Name</Label><Input value={editing.name} onChange={(e) => upd("name", e.target.value)} /></div>
            <div><Label>Slug</Label><Input value={editing.slug} onChange={(e) => upd("slug", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Bundle Price (USD)</Label><Input type="number" step="0.01" value={editing.bundlePriceUsd} onChange={(e) => upd("bundlePriceUsd", e.target.value)} /></div>
            <div><Label>Sort Order</Label><Input type="number" value={editing.sortOrder} onChange={(e) => upd("sortOrder", parseInt(e.target.value) || 0)} /></div>
          </div>
          <div><Label>Short Description</Label><Input value={editing.shortDescription ?? ""} onChange={(e) => upd("shortDescription", e.target.value)} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={editing.description ?? ""} onChange={(e) => upd("description", e.target.value)} /></div>
          <div><Label>Image URL</Label><Input value={editing.imageUrl ?? ""} onChange={(e) => upd("imageUrl", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>SEO Title</Label><Input value={editing.metaTitle ?? ""} onChange={(e) => upd("metaTitle", e.target.value)} /></div>
            <div><Label>SEO Description</Label><Input value={editing.metaDescription ?? ""} onChange={(e) => upd("metaDescription", e.target.value)} /></div>
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-2"><Switch checked={editing.isActive} onCheckedChange={(v) => upd("isActive", v)} /><Label>Active</Label></div>
            <div className="flex items-center gap-2"><Switch checked={editing.isFeatured} onCheckedChange={(v) => upd("isFeatured", v)} /><Label>Featured</Label></div>
          </div>
          <div className="border-t pt-4">
            <Label className="mb-2 block">Products in Bundle ({selectedIds.length} selected)</Label>
            {selectedIds.length > 0 && (
              <div className="space-y-1 mb-3 p-2 bg-muted rounded">
                {selectedIds.map((id, i) => {
                  const p = products.find((x) => x.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between text-sm py-1">
                      <span>{i + 1}. {p?.name || `Product #${id}`}</span>
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
            <Input placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="mb-2" />
            <div className="max-h-40 overflow-y-auto border rounded p-1 space-y-0.5">
              {products.filter((p) => !selectedIds.includes(p.id)).map((p) => (
                <div key={p.id} onClick={() => toggleProduct(p.id)} className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-muted text-sm">
                  <Package className="h-4 w-4 text-muted-foreground" /> {p.name}
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

import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Search, RefreshCw, Download, ChevronLeft, ChevronRight, Plus, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface Variant {
  sku: string;
  priceUsd: string;
  stockCount: number;
  platform: string | null;
}

interface AdminProduct {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  categoryName: string | null;
  isFeatured: boolean;
  isActive: boolean;
  variants: Variant[];
}

interface CategoryOption { id: number; name: string; }

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [cats, setCats] = useState<CategoryOption[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((s) => s.token);
  const [, setLocation] = useLocation();

  const fetchProducts = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);
    if (catFilter) params.set("cat", catFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (platformFilter) params.set("platform", platformFilter);
    fetch(`${API_URL}/admin/products?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.products ?? []);
        setTotal(d.total ?? 0);
        setTotalPages(d.totalPages ?? 1);
        if (d.categories) setCats(d.categories);
        if (d.platforms) setPlatforms(d.platforms);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page, query, catFilter, statusFilter, platformFilter]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openCreate = () => {
    setNewName(""); setCreateError(""); setShowCreate(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleCreate = async () => {
    if (!newName.trim()) { setCreateError("Name is required"); return; }
    setCreating(true); setCreateError("");
    const res = await fetch(`${API_URL}/admin/products`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), isActive: false }),
    });
    setCreating(false);
    if (res.ok) {
      const data = await res.json();
      setLocation(`/admin/products/${data.id}`);
    } else {
      const err = await res.json().catch(() => ({}));
      setCreateError(err.error || "Failed to create product");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    await fetch(`${API_URL}/admin/products/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSyncing(false);
    fetchProducts();
  };

  const handleExport = async (ids?: number[]) => {
    const params = ids?.length ? `?ids=${ids.join(",")}` : "";
    const res = await fetch(`${API_URL}/admin/products/export${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulk = async (action: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    await fetch(`${API_URL}/admin/products/bulk`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action }),
    });
    setSelected(new Set());
    fetchProducts();
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map((p) => p.id)));
  };

  const handleToggle = async (id: number) => {
    await fetch(`${API_URL}/admin/products/${id}/toggle`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchProducts();
  };

  const minPrice = (v: Variant[]) =>
    v.length > 0 ? `$${Math.min(...v.map((x) => Number(x.priceUsd))).toFixed(2)}` : "—";
  const totalStock = (v: Variant[]) => v.reduce((s, x) => s + x.stockCount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Products ({total})</h1>
        <div className="flex gap-2">
          <button
            onClick={openCreate}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "#1e3a8a", border: "1px solid #2563eb", color: "#93c5fd", borderRadius: 5, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            <Plus size={13} /> New Product
          </button>
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`mr-1 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sync from Metenzi
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport()}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full rounded-md border pl-9 pr-3 py-2 text-sm"
            placeholder="Search name or SKU..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          />
        </div>
        <select className="rounded-md border px-3 py-2 text-sm" value={catFilter}
          onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="rounded-md border px-3 py-2 text-sm" value={platformFilter}
          onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }}>
          <option value="">All Platforms</option>
          {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="rounded-md border px-3 py-2 text-sm" value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-blue-50 p-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => handleBulk("activate")}>Set Active</Button>
          <Button size="sm" variant="outline" onClick={() => handleBulk("deactivate")}>Set Inactive</Button>
          <Button size="sm" variant="outline" onClick={() => handleExport(Array.from(selected))}>
            <Download className="mr-1 h-3 w-3" /> Export Selected
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{background:"linear-gradient(to bottom,#0d2040,#0a1830)"}}>
                <th className="px-4 py-3 w-10">
                  <Checkbox checked={selected.size === products.length && products.length > 0} onCheckedChange={toggleAll} />
                </th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-widest">Product</th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-widest">Category</th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-widest">Price</th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-widest">Stock</th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const stock = totalStock(p.variants);
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setLocation(`/admin/products/${p.id}`)}>
                        <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-gray-400">IMG</span>}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.variants.map((v) => v.sku).join(", ") || "No SKU"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.categoryName ?? "—"}</td>
                    <td className="px-4 py-3 font-medium">{minPrice(p.variants)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={stock === 0 ? "bg-red-100 text-red-800" : stock < 5 ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}>{stock}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggle(p.id)}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${p.isActive ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {p.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Create Product Modal ── */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div style={{ background: "#1a1d28", border: "1px solid #252836", borderRadius: 8, padding: "20px 24px", width: 380, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>New Product</span>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#566070", display: "flex" }}><X size={14} /></button>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#566070", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Product Name</label>
              <input
                ref={nameInputRef}
                style={{ width: "100%", background: "#0f1117", border: "1px solid #252836", borderRadius: 4, padding: "6px 10px", fontSize: 12, color: "#c8d0e0", outline: "none", boxSizing: "border-box" }}
                placeholder="e.g. Microsoft Office 2024"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setCreateError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              {createError && <p style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>{createError}</p>}
            </div>
            <p style={{ fontSize: 10, color: "#4a5568", margin: 0 }}>
              The product will be created as <strong style={{ color: "#8b94a8" }}>Inactive</strong>. You can fill in all details on the next screen.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowCreate(false)}
                style={{ background: "none", border: "1px solid #252836", color: "#8b94a8", borderRadius: 4, padding: "5px 14px", fontSize: 12, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleCreate} disabled={creating}
                style={{ background: "#1e3a8a", border: "1px solid #2563eb", color: "#93c5fd", borderRadius: 4, padding: "5px 16px", fontSize: 12, fontWeight: 600, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.6 : 1 }}>
                {creating ? "Creating…" : "Create & Edit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

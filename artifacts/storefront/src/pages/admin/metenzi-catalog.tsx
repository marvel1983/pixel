import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RefreshCw, Search, LinkOff, Download,
  Check, AlertTriangle, ChevronLeft, ChevronRight,
  Package, X,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface MetenziProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  platform: string;
  b2bPrice: string;
  retailPrice: string;
  currency: string;
  stock: number;
  status: string;
  imageUrl: string | null;
  description: string;
  shortDescription: string;
  // overlay fields
  mapped: boolean;
  mappingId: number | null;
  autoSyncStock: boolean;
  pixelProduct: { id: number; name: string; slug: string } | null;
}

interface PixelProductSearch {
  id: number;
  name: string;
  slug: string;
}

const SYNC_FIELDS = [
  { key: "name",             label: "Name" },
  { key: "image",            label: "Image" },
  { key: "b2bPrice",         label: "B2B Price" },
  { key: "retailPrice",      label: "Retail Price" },
  { key: "description",      label: "Description" },
  { key: "shortDescription", label: "Short Desc" },
  { key: "sku",              label: "SKU" },
  { key: "stock",            label: "Stock" },
] as const;

type SyncFieldKey = typeof SYNC_FIELDS[number]["key"];

// ── Main page ────────────────────────────────────────────────────────────────

export default function MetenziCatalogPage() {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Catalog state
  const [products, setProducts] = useState<MetenziProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [platform, setPlatform] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [configured, setConfigured] = useState(true);

  // Selected product & right panel
  const [selected, setSelected] = useState<MetenziProduct | null>(null);

  // Mapping state (right panel)
  const [pixelSearch, setPixelSearch] = useState("");
  const [pixelResults, setPixelResults] = useState<PixelProductSearch[]>([]);
  const [pixelSearchLoading, setPixelSearchLoading] = useState(false);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [syncingFields, setSyncingFields] = useState<Set<SyncFieldKey>>(new Set());

  // Import modal
  const [showImport, setShowImport] = useState(false);
  const [importFields, setImportFields] = useState<Set<SyncFieldKey>>(
    new Set(["name", "image", "b2bPrice", "retailPrice", "description", "shortDescription", "sku", "stock"] as SyncFieldKey[])
  );
  const [importLoading, setImportLoading] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch catalog ──────────────────────────────────────────────────────────

  const fetchCatalog = useCallback(async (p = page, s = search, cat = category, plt = platform) => {
    setLoadingCatalog(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) });
      if (s)   params.set("search",   s);
      if (cat) params.set("category", cat);
      if (plt) params.set("platform", plt);
      const res = await fetch(`${API}/admin/metenzi/catalog?${params}`, { headers });
      if (res.status === 503) { setConfigured(false); return; }
      const data = await res.json();
      setProducts(data.products ?? []);
      setTotal(data.total ?? 0);
      setConfigured(true);
    } catch {
      setConfigured(false);
    } finally {
      setLoadingCatalog(false);
    }
  }, [page, search, category, platform, limit]);

  useEffect(() => { fetchCatalog(page, search, category, platform); }, [page, category, platform]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchCatalog(1, search, category, platform);
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // Fetch meta (categories/platforms)
  useEffect(() => {
    fetch(`${API}/admin/metenzi/catalog/meta`, { headers })
      .then((r) => r.json())
      .then((d) => {
        setCategories(d.categories ?? []);
        setPlatforms(d.platforms ?? []);
      })
      .catch(() => {});
  }, []);

  // Sync selected product data when products list refreshes
  useEffect(() => {
    if (selected) {
      const updated = products.find((p) => p.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [products]);

  // ── Pixel product search ───────────────────────────────────────────────────

  const handlePixelSearch = useCallback((q: string) => {
    setPixelSearch(q);
    if (q.length < 2) { setPixelResults([]); return; }
    setPixelSearchLoading(true);
    fetch(`${API}/admin/metenzi/pixel-products-search?q=${encodeURIComponent(q)}`, { headers })
      .then((r) => r.json())
      .then(setPixelResults)
      .finally(() => setPixelSearchLoading(false));
  }, []);

  // ── Map to existing pixel product ─────────────────────────────────────────

  const handleMap = async (pixelProductId: number) => {
    if (!selected) return;
    setMappingLoading(true);
    try {
      await fetch(`${API}/admin/metenzi/mappings`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          metenziProductId: selected.id,
          metenziSku: selected.sku,
          metenziName: selected.name,
          pixelProductId,
        }),
      });
      setPixelSearch("");
      setPixelResults([]);
      await fetchCatalog(page, search, category, platform);
    } finally {
      setMappingLoading(false);
    }
  };

  // ── Unmap ──────────────────────────────────────────────────────────────────

  const handleUnmap = async () => {
    if (!selected?.mappingId) return;
    if (!window.confirm(`Remove mapping for "${selected.name}"?`)) return;
    setMappingLoading(true);
    try {
      await fetch(`${API}/admin/metenzi/mappings/${selected.mappingId}`, { method: "DELETE", headers });
      await fetchCatalog(page, search, category, platform);
    } finally {
      setMappingLoading(false);
    }
  };

  // ── Toggle auto sync stock ─────────────────────────────────────────────────

  const handleToggleAutoSync = async () => {
    if (!selected?.mappingId) return;
    const next = !selected.autoSyncStock;
    setMappingLoading(true);
    try {
      await fetch(`${API}/admin/metenzi/mappings/${selected.mappingId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ autoSyncStock: next }),
      });
      await fetchCatalog(page, search, category, platform);
    } finally {
      setMappingLoading(false);
    }
  };

  // ── Sync individual field ──────────────────────────────────────────────────

  const handleSyncField = async (field: SyncFieldKey) => {
    if (!selected?.mappingId) return;
    setSyncingFields((prev) => new Set(prev).add(field));
    try {
      const res = await fetch(`${API}/admin/metenzi/sync-field`, {
        method: "POST",
        headers,
        body: JSON.stringify({ mappingId: selected.mappingId, fields: [field] }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error ?? "Sync failed");
      }
      await fetchCatalog(page, search, category, platform);
    } finally {
      setSyncingFields((prev) => { const s = new Set(prev); s.delete(field); return s; });
    }
  };

  // ── Import as new product ──────────────────────────────────────────────────

  const handleImport = async () => {
    if (!selected) return;
    setImportLoading(true);
    try {
      const res = await fetch(`${API}/admin/metenzi/import`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          metenziProductId: selected.id,
          fields: Array.from(importFields),
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Import failed"); return; }
      setShowImport(false);
      await fetchCatalog(page, search, category, platform);
    } finally {
      setImportLoading(false);
    }
  };

  // ── UI helpers ─────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(total / limit);

  if (!configured) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Metenzi Catalog</h1>
        <div className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}>
          <div className="py-12 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-lg font-medium text-[#dde4f0]">Metenzi API not configured</p>
            <p className="text-sm text-[#5a6a84] mt-2">Set up your API keys in Settings → API Keys to enable this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Metenzi Catalog</h1>
          <p className="text-sm text-[#5a6a84]">{total} products · page {page}/{totalPages || 1}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchCatalog(page, search, category, platform)} disabled={loadingCatalog}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loadingCatalog ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#5a6a84]" />
          <Input
            className="pl-8 bg-[#181c24] border-[#2e3340] text-[#dde4f0] placeholder:text-[#5a6a84]"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <select
            className="px-3 py-1.5 rounded-md border border-[#2e3340] bg-[#181c24] text-[#dde4f0] text-sm"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {platforms.length > 0 && (
          <select
            className="px-3 py-1.5 rounded-md border border-[#2e3340] bg-[#181c24] text-[#dde4f0] text-sm"
            value={platform}
            onChange={(e) => { setPlatform(e.target.value); setPage(1); }}
          >
            <option value="">All platforms</option>
            {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {/* Split panel */}
      <div className="flex gap-4 min-h-0 flex-1">
        {/* LEFT: Product list */}
        <div className="flex flex-col gap-2 w-full max-w-[480px] overflow-y-auto pr-1">
          {loadingCatalog && products.length === 0 && (
            <div className="text-center py-8 text-[#5a6a84]">Loading...</div>
          )}
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                selected?.id === p.id
                  ? "border-blue-500 bg-[#1a2236]"
                  : "border-[#2e3340] bg-[#181c24] hover:border-[#3a4050] hover:bg-[#1e2128]"
              }`}
            >
              <div className="flex items-center gap-2">
                {p.imageUrl && (
                  <img src={p.imageUrl} alt={p.name} className="h-10 w-10 rounded object-cover flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] font-medium text-[#dde4f0] truncate">{p.name}</span>
                    {p.mapped
                      ? <Badge className="text-[10px] px-1.5 py-0 bg-green-900/50 text-green-300 border-green-700">mapped</Badge>
                      : <Badge className="text-[10px] px-1.5 py-0 bg-[#2e3340] text-[#5a6a84]">unmapped</Badge>
                    }
                    {p.autoSyncStock && <Badge className="text-[10px] px-1.5 py-0 bg-blue-900/50 text-blue-300 border-blue-700">auto-stock</Badge>}
                  </div>
                  <div className="text-[11px] text-[#5a6a84] flex gap-2 mt-0.5">
                    <span>{p.sku}</span>
                    {p.category && <span>· {p.category}</span>}
                    {p.platform && <span>· {p.platform}</span>}
                    <span>· stock: {p.stock}</span>
                    <span>· {p.b2bPrice} / {p.retailPrice}</span>
                  </div>
                  {p.pixelProduct && (
                    <div className="text-[11px] text-blue-400 mt-0.5 truncate">→ {p.pixelProduct.name}</div>
                  )}
                </div>
              </div>
            </button>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2 pb-1">
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loadingCatalog}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-[#5a6a84]">{page} / {totalPages}</span>
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loadingCatalog}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* RIGHT: Detail panel */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="rounded-lg border border-[#2e3340] bg-[#181c24] flex items-center justify-center h-64" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}>
              <div className="text-center text-[#5a6a84]">
                <Package className="mx-auto h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">Select a product from the list</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[#2e3340] bg-[#181c24] overflow-hidden" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}>
              {/* Product header */}
              <div className="border-b border-[#2a2e3a] px-5 py-4 bg-[#1e2128]">
                <div className="flex items-start gap-3">
                  {selected.imageUrl && (
                    <img src={selected.imageUrl} alt={selected.name} className="h-14 w-14 rounded object-cover flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-[#dde4f0]">{selected.name}</h2>
                    <div className="text-xs text-[#5a6a84] mt-0.5 flex flex-wrap gap-2">
                      <span>SKU: {selected.sku}</span>
                      <span>ID: {selected.id}</span>
                      {selected.category && <span>· {selected.category}</span>}
                      {selected.platform && <span>· {selected.platform}</span>}
                    </div>
                    <div className="text-xs text-[#5a6a84] mt-0.5 flex flex-wrap gap-2">
                      <span>B2B: <strong className="text-[#dde4f0]">{selected.b2bPrice} {selected.currency}</strong></span>
                      <span>Retail: <strong className="text-[#dde4f0]">{selected.retailPrice} {selected.currency}</strong></span>
                      <span>Stock: <strong className="text-[#dde4f0]">{selected.stock}</strong></span>
                    </div>
                  </div>
                  {selected.mapped && (
                    <span className="flex-shrink-0">
                      <Badge className="bg-green-900/50 text-green-300 border-green-700 text-xs">Mapped</Badge>
                    </span>
                  )}
                </div>
              </div>

              <div className="px-5 py-4 space-y-5">
                {/* Mapped state */}
                {selected.mapped && selected.pixelProduct && (
                  <>
                    {/* Linked product info */}
                    <div className="flex items-center justify-between p-3 rounded-md bg-[#1a2236] border border-blue-900/40">
                      <div>
                        <p className="text-xs text-[#5a6a84]">Linked Pixel product</p>
                        <p className="text-sm font-medium text-[#dde4f0] mt-0.5">{selected.pixelProduct.name}</p>
                        <p className="text-xs text-[#5a6a84]">/{selected.pixelProduct.slug}</p>
                      </div>
                      <div className="flex flex-col gap-1.5 items-end">
                        <Button size="sm" variant="outline" className="h-7 text-xs border-red-800 text-red-400 hover:bg-red-950" onClick={handleUnmap} disabled={mappingLoading}>
                          <LinkOff className="mr-1 h-3 w-3" /> Unmap
                        </Button>
                      </div>
                    </div>

                    {/* Auto sync stock */}
                    <div className="flex items-center justify-between p-3 rounded-md bg-[#181c24] border border-[#2e3340]">
                      <div>
                        <p className="text-sm font-medium text-[#dde4f0]">Auto-sync stock</p>
                        <p className="text-xs text-[#5a6a84]">Update stock every 15 min from Metenzi</p>
                      </div>
                      <button
                        onClick={handleToggleAutoSync}
                        disabled={mappingLoading}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                          selected.autoSyncStock ? "bg-blue-600" : "bg-[#2e3340]"
                        }`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${selected.autoSyncStock ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </div>

                    {/* Sync fields */}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#5a6a84] mb-2">Sync individual fields</p>
                      <div className="grid grid-cols-2 gap-2">
                        {SYNC_FIELDS.map(({ key, label }) => {
                          const syncing = syncingFields.has(key);
                          return (
                            <button
                              key={key}
                              onClick={() => handleSyncField(key)}
                              disabled={syncing || mappingLoading}
                              className="flex items-center justify-between px-3 py-2 rounded-md border border-[#2e3340] bg-[#1e2128] hover:border-[#3a4050] hover:bg-[#232832] text-left transition-colors disabled:opacity-60"
                            >
                              <span className="text-sm text-[#dde4f0]">{label}</span>
                              {syncing
                                ? <RefreshCw className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                                : <RefreshCw className="h-3.5 w-3.5 text-[#5a6a84]" />
                              }
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* Unmapped state */}
                {!selected.mapped && (
                  <div className="space-y-4">
                    {/* Map to existing */}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#5a6a84] mb-2">Link to existing Pixel product</p>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#5a6a84]" />
                        <Input
                          className="pl-8 bg-[#181c24] border-[#2e3340] text-[#dde4f0] placeholder:text-[#5a6a84]"
                          placeholder="Search Pixel products..."
                          value={pixelSearch}
                          onChange={(e) => handlePixelSearch(e.target.value)}
                        />
                      </div>
                      {pixelSearchLoading && <p className="text-xs text-[#5a6a84] mt-1 ml-1">Searching...</p>}
                      {pixelResults.length > 0 && (
                        <div className="mt-1 rounded-md border border-[#2e3340] bg-[#1e2128] divide-y divide-[#2e3340] max-h-48 overflow-y-auto">
                          {pixelResults.map((pp) => (
                            <button
                              key={pp.id}
                              onClick={() => handleMap(pp.id)}
                              disabled={mappingLoading}
                              className="w-full text-left px-3 py-2.5 hover:bg-[#232832] transition-colors"
                            >
                              <p className="text-sm text-[#dde4f0]">{pp.name}</p>
                              <p className="text-xs text-[#5a6a84]">/{pp.slug}</p>
                            </button>
                          ))}
                        </div>
                      )}
                      {pixelSearch.length >= 2 && !pixelSearchLoading && pixelResults.length === 0 && (
                        <p className="text-xs text-[#5a6a84] mt-1 ml-1">No products found</p>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-[#2e3340]" />
                      <span className="text-xs text-[#5a6a84]">or</span>
                      <div className="flex-1 h-px bg-[#2e3340]" />
                    </div>

                    {/* Import as new */}
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setShowImport(true)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Import as new Pixel product
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import modal */}
      {showImport && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-[#2e3340] bg-[#181c24] shadow-2xl">
            <div className="border-b border-[#2a2e3a] px-5 py-4 bg-[#1e2128] flex items-center justify-between rounded-t-xl">
              <div>
                <p className="font-semibold text-[#dde4f0]">Import product</p>
                <p className="text-xs text-[#5a6a84] mt-0.5 truncate max-w-[300px]">{selected.name}</p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-[#5a6a84] hover:text-[#dde4f0]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-[#5a6a84]">Choose which fields to import from Metenzi:</p>
              <div className="grid grid-cols-2 gap-2">
                {SYNC_FIELDS.map(({ key, label }) => {
                  const checked = importFields.has(key);
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md border cursor-pointer transition-colors ${
                        checked ? "border-blue-600 bg-blue-900/20" : "border-[#2e3340] bg-[#1e2128] hover:border-[#3a4050]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        className="hidden"
                        onChange={() => {
                          setImportFields((prev) => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key); else next.add(key);
                            return next;
                          });
                        }}
                      />
                      <div className={`h-4 w-4 rounded flex items-center justify-center flex-shrink-0 ${checked ? "bg-blue-600" : "border border-[#3a4050] bg-[#181c24]"}`}>
                        {checked && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-sm text-[#dde4f0]">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="border-t border-[#2a2e3a] px-5 py-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowImport(false)} disabled={importLoading}>Cancel</Button>
              <Button onClick={handleImport} disabled={importLoading || importFields.size === 0}>
                {importLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Import
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, RefreshCw, Unlink, Download, Check,
  ChevronLeft, ChevronRight, X, AlertTriangle, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface MetenziProduct {
  id: string; sku: string; name: string; category: string; platform: string;
  b2bPrice: string; retailPrice: string; currency: string; stock: number;
  status: string; imageUrl: string | null; description: string; shortDescription: string;
  mapped: boolean; mappingId: number | null; autoSyncStock: boolean;
  pixelProduct: { id: number; name: string; slug: string } | null;
}
interface PixelSearch { id: number; name: string; slug: string }

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

const CSYM: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };
const csym = (c: string) => CSYM[c] ?? c;
const imgProxy = (url: string | null) =>
  url ? `${API}/admin/metenzi/proxy-image?url=${encodeURIComponent(url)}` : null;
const skuShort = (sku: string) => sku.length > 8 ? `${sku.slice(0, 8)}…` : sku;
const nameShort = (n: string) => n.length > 45 ? `${n.slice(0, 45)}…` : n;

const thBase = "border-b border-r border-[#2a2e3a] bg-[#1e2128] px-2.5 py-[8px] text-[10.5px] font-bold uppercase tracking-widest select-none whitespace-nowrap card-title";
const td = "border-b border-r border-[#1f2840] px-2.5 py-[5px] align-middle text-[12.5px] leading-none text-[#dde4f0] whitespace-nowrap";

export default function MetenziCatalogPage() {
  const token = localStorage.getItem("token");
  const hdrs: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [products, setProducts]     = useState<MetenziProduct[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState("");
  const [category, setCategory]     = useState("");
  const [platform, setPlatform]     = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [platforms, setPlatforms]   = useState<string[]>([]);
  const [loading, setLoading]       = useState(false);
  const [configured, setConfigured] = useState(true);
  const [selected, setSelected]     = useState<MetenziProduct | null>(null);
  const [drawer, setDrawer]         = useState(false);
  const [pixelQuery, setPixelQuery]       = useState("");
  const [pixelResults, setPixelResults]   = useState<PixelSearch[]>([]);
  const [pixelLoading, setPixelLoading]   = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncingFields, setSyncingFields] = useState<Set<SyncFieldKey>>(new Set());
  const [syncedResult, setSyncedResult]   = useState<string[]>([]);
  const [showImport, setShowImport]   = useState(false);
  const [importFields, setImportFields] = useState<Set<SyncFieldKey>>(
    new Set(["name","image","b2bPrice","retailPrice","description","shortDescription","sku","stock"] as SyncFieldKey[])
  );
  const [importLoading, setImportLoading] = useState(false);

  const limit = 20;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCatalog = useCallback(async (p = page, s = search, cat = category, plt = platform) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) });
      if (s)   params.set("search", s);
      if (cat) params.set("category", cat);
      if (plt) params.set("platform", plt);
      const res = await fetch(`${API}/admin/metenzi/catalog?${params}`, { headers: hdrs });
      if (res.status === 503) { setConfigured(false); return; }
      const data = await res.json();
      setProducts(data.products ?? []);
      setTotal(data.total ?? 0);
      setConfigured(true);
    } catch { setConfigured(false); }
    finally { setLoading(false); }
  }, [page, search, category, platform]);

  useEffect(() => { fetchCatalog(page, search, category, platform); }, [page, category, platform]);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); fetchCatalog(1, search, category, platform); }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);
  useEffect(() => {
    fetch(`${API}/admin/metenzi/catalog/meta`, { headers: hdrs })
      .then(r => r.json()).then(d => { setCategories(d.categories ?? []); setPlatforms(d.platforms ?? []); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (selected) {
      const updated = products.find(p => p.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [products]);

  const handlePixelSearch = useCallback((q: string) => {
    setPixelQuery(q);
    if (q.length < 2) { setPixelResults([]); return; }
    setPixelLoading(true);
    fetch(`${API}/admin/metenzi/pixel-products-search?q=${encodeURIComponent(q)}`, { headers: hdrs })
      .then(r => r.json()).then(setPixelResults).finally(() => setPixelLoading(false));
  }, []);

  const handleMap = async (pixelProductId: number) => {
    if (!selected) return;
    setActionLoading(true);
    await fetch(`${API}/admin/metenzi/mappings`, {
      method: "POST", headers: hdrs,
      body: JSON.stringify({ metenziProductId: selected.id, metenziSku: selected.sku, metenziName: selected.name, pixelProductId }),
    });
    setPixelQuery(""); setPixelResults([]);
    await fetchCatalog(page, search, category, platform);
    setActionLoading(false);
  };

  const handleUnmap = async () => {
    if (!selected?.mappingId || !confirm(`Remove mapping for "${selected.name}"?`)) return;
    setActionLoading(true);
    await fetch(`${API}/admin/metenzi/mappings/${selected.mappingId}`, { method: "DELETE", headers: hdrs });
    await fetchCatalog(page, search, category, platform);
    setActionLoading(false);
  };

  const handleToggleAutoSync = async () => {
    if (!selected?.mappingId) return;
    setActionLoading(true);
    await fetch(`${API}/admin/metenzi/mappings/${selected.mappingId}`, {
      method: "PATCH", headers: hdrs,
      body: JSON.stringify({ autoSyncStock: !selected.autoSyncStock }),
    });
    await fetchCatalog(page, search, category, platform);
    setActionLoading(false);
  };

  const handleSyncField = async (field: SyncFieldKey) => {
    if (!selected?.mappingId) return;
    setSyncingFields(prev => new Set(prev).add(field));
    setSyncedResult([]);
    const res = await fetch(`${API}/admin/metenzi/sync-field`, {
      method: "POST", headers: hdrs,
      body: JSON.stringify({ mappingId: selected.mappingId, fields: [field] }),
    });
    const data = await res.json();
    if (res.ok && data.success) setSyncedResult(data.synced ?? [field]);
    else alert(data.error ?? "Sync failed");
    await fetchCatalog(page, search, category, platform);
    setSyncingFields(prev => { const s = new Set(prev); s.delete(field); return s; });
  };

  const handleImport = async () => {
    if (!selected) return;
    setImportLoading(true);
    const res = await fetch(`${API}/admin/metenzi/import`, {
      method: "POST", headers: hdrs,
      body: JSON.stringify({ metenziProductId: selected.id, fields: Array.from(importFields) }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error ?? "Import failed"); setImportLoading(false); return; }
    setShowImport(false);
    await fetchCatalog(page, search, category, platform);
    setImportLoading(false);
  };

  const openDrawer = (p: MetenziProduct) => {
    setSelected(p); setDrawer(true); setPixelQuery(""); setPixelResults([]); setSyncedResult([]);
  };

  const totalPages = Math.ceil(total / limit);

  if (!configured) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-white">Metenzi Catalog</h1>
      <div className="rounded-md border border-[#1e2a40] bg-[#0c1018] p-12 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-400 mb-3" />
        <p className="text-base font-medium text-[#dde4f0]">Metenzi API not configured</p>
        <p className="text-sm text-[#5a6a84] mt-1">Set up your API keys in Settings → API Keys.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 text-[#e8edf5]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-white">Metenzi Catalog</h1>
        <Button size="sm" variant="outline" className="border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] hover:bg-[#252a38]" onClick={() => fetchCatalog(page, search, category, platform)} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2.5 rounded-md border border-[#2d3344] bg-[#161a24] p-2.5">
        <div className="min-w-[200px] flex-1 relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b95ab]" />
          <input className="h-8 w-full rounded border border-[#3d4558] bg-[#0f1117] pl-8 pr-2 text-[13px] text-[#e8edf5] placeholder:text-[#6b7280] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
            placeholder="Search products..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {categories.length > 0 && (
          <select className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {platforms.length > 0 && (
          <select className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]" value={platform} onChange={e => { setPlatform(e.target.value); setPage(1); }}>
            <option value="">All platforms</option>
            {platforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-[13px] text-[#9ca8bc]">
        <span className="text-[#e8edf5]">{total} products</span>
        <span>Page <strong className="text-white">{page}</strong> / {totalPages || 1}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-px rounded-md overflow-hidden border border-[#1e2638]">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-[28px] rounded-none bg-[#181e2c]" />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[#1e2a40] bg-[#0c1018]" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          <table className="w-full border-collapse text-left" style={{ borderSpacing: 0 }}>
            <thead>
              <tr className="border-b-2 border-[#2a2e3a]" style={{ backgroundColor: "#1e2128" }}>
                <th className={`${thBase} border-l-0`} style={{ color: "#fff" }}>Product</th>
                <th className={thBase} style={{ color: "#fff" }}>SKU</th>
                <th className={thBase} style={{ color: "#fff" }}>Category</th>
                <th className={thBase} style={{ color: "#fff" }}>Platform</th>
                <th className={`${thBase} text-right`} style={{ color: "#fff" }}>B2B</th>
                <th className={`${thBase} text-right`} style={{ color: "#fff" }}>Retail</th>
                <th className={`${thBase} text-right`} style={{ color: "#fff" }}>Stock</th>
                <th className={thBase} style={{ color: "#fff" }}>Status</th>
                <th className={`${thBase} border-r-0`} style={{ color: "#fff" }}>Linked product</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id} onClick={() => openDrawer(p)}
                  className={`cursor-pointer transition-colors duration-75 ${selected?.id === p.id ? "bg-sky-500/10" : i % 2 === 0 ? "bg-[#0c1018] hover:bg-[#111825]" : "bg-[#0f1520] hover:bg-[#141e2e]"}`}
                >
                  <td className={`${td} border-l-0`}>
                    <div className="flex items-center gap-2">
                      {imgProxy(p.imageUrl)
                        ? <img src={imgProxy(p.imageUrl)!} alt="" className="h-6 w-6 rounded object-cover flex-shrink-0 bg-[#1a1f2e]" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        : <Package className="h-4 w-4 text-[#3d4558] flex-shrink-0" />
                      }
                      <span title={p.name}>{nameShort(p.name)}</span>
                    </div>
                  </td>
                  <td className={`${td} font-mono text-[11px] text-[#8b95ab]`}>
                    <span title={p.sku}>{skuShort(p.sku)}</span>
                  </td>
                  <td className={`${td} text-[11px] text-[#8b95ab]`}>{p.category || "—"}</td>
                  <td className={`${td} text-[11px] text-[#8b95ab]`}>{p.platform || "—"}</td>
                  <td className={`${td} text-right tabular-nums`}>{p.b2bPrice} {csym(p.currency)}</td>
                  <td className={`${td} text-right tabular-nums`}>{p.retailPrice} {csym(p.currency)}</td>
                  <td className={`${td} text-right tabular-nums`}>{p.stock}</td>
                  <td className={td}>
                    {p.mapped
                      ? <span className="inline-flex items-center justify-center rounded border border-emerald-400 bg-emerald-500/40 px-1.5 text-[10px] font-bold text-emerald-100 tracking-wider" style={{ height: 17 }}>mapped</span>
                      : <span className="inline-flex items-center justify-center rounded border border-red-500 bg-red-500/20 px-1.5 text-[10px] font-bold text-red-400 tracking-wider" style={{ height: 17 }}>unmapped</span>
                    }
                    {p.autoSyncStock && (
                      <span className="ml-1 inline-flex items-center justify-center rounded border border-sky-400 bg-sky-500/40 px-1.5 text-[10px] font-bold text-sky-100 tracking-wider" style={{ height: 17 }}>auto-sync</span>
                    )}
                  </td>
                  <td className={`${td} border-r-0 text-[11px] text-[#5a8fcc]`}>
                    {p.pixelProduct ? p.pixelProduct.name : <span className="text-[#3d4558]">—</span>}
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-12 text-center text-[13px] text-[#4a5570]">No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[13px] text-[#9ca8bc]">
          <Button size="sm" variant="outline" className="h-8 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <span>Page <span className="tabular-nums text-[#e8edf5]">{page}</span> of <span className="tabular-nums text-[#e8edf5]">{totalPages}</span></span>
          <Button size="sm" variant="outline" className="h-8 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── Side drawer ──────────────────────────────────────────────────────── */}
      {drawer && selected && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="w-full max-w-[440px] flex flex-col h-full bg-[#0f1420] border-l border-[#1e2a40] shadow-2xl overflow-y-auto">
            {/* header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#1e2a40] px-5 py-4 bg-[#1e2128]">
              <div className="flex items-start gap-3 min-w-0">
                {imgProxy(selected.imageUrl)
                  ? <img src={imgProxy(selected.imageUrl)!} alt="" className="h-14 w-14 rounded object-cover flex-shrink-0 bg-[#1a1f2e]" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  : <div className="h-14 w-14 rounded bg-[#1a1f2e] flex items-center justify-center flex-shrink-0"><Package className="h-6 w-6 text-[#3d4558]" /></div>
                }
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#dde4f0] leading-snug">{selected.name}</p>
                  <p className="text-[11px] text-[#5a6a84] mt-0.5 font-mono">{selected.sku} · {selected.id}</p>
                  <p className="text-[11px] text-[#5a6a84]">
                    B2B: <strong className="text-[#dde4f0]">{selected.b2bPrice}{csym(selected.currency)}</strong> · Retail: <strong className="text-[#dde4f0]">{selected.retailPrice}{csym(selected.currency)}</strong> · Stock: <strong className="text-[#dde4f0]">{selected.stock}</strong>
                  </p>
                </div>
              </div>
              <button onClick={() => setDrawer(false)} className="text-[#5a6a84] hover:text-[#dde4f0] flex-shrink-0 mt-0.5"><X className="h-5 w-5" /></button>
            </div>

            <div className="px-5 py-5 space-y-5 flex-1">
              {/* Sync feedback */}
              {syncedResult.length > 0 && (
                <div className="rounded border border-emerald-800 bg-emerald-900/20 px-3 py-2 flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-[12px] text-emerald-300">Synced: <strong>{syncedResult.join(", ")}</strong></span>
                </div>
              )}

              {selected.mapped && selected.pixelProduct ? (
                <>
                  {/* Linked product */}
                  <div className="rounded-md border border-sky-900/40 bg-sky-950/20 p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-[#5a6a84]">Linked Pixel product</p>
                      <p className="text-sm font-medium text-[#dde4f0] mt-0.5">{selected.pixelProduct.name}</p>
                      <p className="text-[11px] text-[#5a6a84]">/{selected.pixelProduct.slug}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] border-red-800 text-red-400 hover:bg-red-950 flex-shrink-0" onClick={handleUnmap} disabled={actionLoading}>
                      <Unlink className="mr-1 h-3 w-3" /> Unmap
                    </Button>
                  </div>

                  {/* Auto-sync toggle */}
                  <div className="flex items-center justify-between rounded-md border border-[#2a2e3a] bg-[#161a24] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#dde4f0]">Auto-sync stock</p>
                      <p className="text-[11px] text-[#5a6a84]">Update stock every 15 min from Metenzi</p>
                    </div>
                    <button onClick={handleToggleAutoSync} disabled={actionLoading}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${selected.autoSyncStock ? "bg-sky-600" : "bg-[#2e3340]"}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${selected.autoSyncStock ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>

                  {/* Sync fields */}
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#5a6a84] mb-2">Sync individual fields</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SYNC_FIELDS.map(({ key, label }) => {
                        const syncing = syncingFields.has(key);
                        const synced  = syncedResult.includes(key);
                        return (
                          <button key={key} onClick={() => handleSyncField(key)} disabled={syncing || actionLoading}
                            className={`flex items-center justify-between rounded border px-3 py-2 text-left transition-colors disabled:opacity-60 ${synced ? "border-emerald-700 bg-emerald-900/20" : "border-[#2a2e3a] bg-[#161a24] hover:border-[#3a4050] hover:bg-[#1e2332]"}`}>
                            <span className={`text-[13px] ${synced ? "text-emerald-300" : "text-[#dde4f0]"}`}>{label}</span>
                            {synced
                              ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                              : <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "text-sky-400 animate-spin" : "text-[#5a6a84]"}`} />
                            }
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#5a6a84] mb-2">Link to existing Pixel product</p>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5a6a84]" />
                      <input className="h-8 w-full rounded border border-[#3d4558] bg-[#0f1117] pl-8 pr-2 text-[13px] text-[#e8edf5] placeholder:text-[#6b7280] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
                        placeholder="Search Pixel products..." value={pixelQuery} onChange={e => handlePixelSearch(e.target.value)} />
                    </div>
                    {pixelLoading && <p className="text-[11px] text-[#5a6a84] mt-1 ml-1">Searching...</p>}
                    {pixelResults.length > 0 && (
                      <div className="mt-1 rounded border border-[#2a2e3a] bg-[#0f1117] divide-y divide-[#1e2638] max-h-48 overflow-y-auto">
                        {pixelResults.map(pp => (
                          <button key={pp.id} onClick={() => handleMap(pp.id)} disabled={actionLoading} className="w-full text-left px-3 py-2 hover:bg-[#161a24] transition-colors">
                            <p className="text-[13px] text-[#dde4f0]">{pp.name}</p>
                            <p className="text-[11px] text-[#5a6a84]">/{pp.slug}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    {pixelQuery.length >= 2 && !pixelLoading && pixelResults.length === 0 && (
                      <p className="text-[11px] text-[#5a6a84] mt-1 ml-1">No products found</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-[#2a2e3a]" />
                    <span className="text-[11px] text-[#5a6a84]">or</span>
                    <div className="flex-1 h-px bg-[#2a2e3a]" />
                  </div>
                  <Button variant="outline" className="w-full border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] hover:bg-[#252a38]" onClick={() => setShowImport(true)}>
                    <Download className="mr-2 h-4 w-4" /> Import as new Pixel product
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Import modal ──────────────────────────────────────────────────────── */}
      {showImport && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#2a2e3a] bg-[#0f1420] shadow-2xl">
            <div className="border-b border-[#1e2a40] px-5 py-4 bg-[#1e2128] rounded-t-lg flex items-center gap-3">
              {imgProxy(selected.imageUrl)
                ? <img src={imgProxy(selected.imageUrl)!} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0 bg-[#1a1f2e]" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                : <div className="h-10 w-10 rounded bg-[#1a1f2e] flex items-center justify-center flex-shrink-0"><Package className="h-5 w-5 text-[#3d4558]" /></div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#dde4f0]">Import as new product</p>
                <p className="text-[11px] text-[#5a6a84] mt-0.5 truncate">{selected.name}</p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-[#5a6a84] hover:text-[#dde4f0]"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-[12px] text-[#5a6a84]">Choose which fields to import:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {SYNC_FIELDS.map(({ key, label }) => {
                  const checked = importFields.has(key);
                  return (
                    <label key={key} className={`flex items-center gap-2 rounded border px-3 py-2 cursor-pointer transition-colors ${checked ? "border-sky-700 bg-sky-900/20" : "border-[#2a2e3a] bg-[#161a24] hover:border-[#3a4050]"}`}>
                      <input type="checkbox" className="hidden" checked={checked} onChange={() => {
                        setImportFields(prev => { const n = new Set(prev); checked ? n.delete(key) : n.add(key); return n; });
                      }} />
                      <div className={`h-4 w-4 rounded flex items-center justify-center flex-shrink-0 ${checked ? "bg-sky-600" : "border border-[#3d4558]"}`}>
                        {checked && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-[13px] text-[#dde4f0]">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="border-t border-[#1e2a40] px-5 py-4 flex justify-end gap-2">
              <Button variant="outline" className="border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5]" onClick={() => setShowImport(false)} disabled={importLoading}>Cancel</Button>
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

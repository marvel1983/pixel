import { useState, useEffect } from "react";
import { ChevronRight, ArrowLeft, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocation } from "wouter";
import { PLATFORM_META, ALL_PLATFORMS, getPlatformMeta } from "./platform-meta";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface PlatformStat { platform: string; variantCount: number; productCount: number; }
interface Variant { id: number; sku: string; platform: string | null; priceUsd: string; stockCount: number; }
interface ProductRow { id: number; name: string; slug: string; isActive: boolean; variants: Variant[]; }

export default function AdminPlatformsPage() {
  const token = useAuthStore((s) => s.token);
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState<PlatformStat[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const authHeader = { Authorization: `Bearer ${token}` };

  function loadStats() {
    setLoadingStats(true);
    fetch(`${API}/admin/platforms/stats`, { headers: authHeader })
      .then((r) => r.json())
      .then((d) => setStats(d.stats ?? []))
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }

  useEffect(loadStats, [token]);

  useEffect(() => {
    if (!selected) return;
    setLoadingProducts(true);
    setProducts([]);
    fetch(`${API}/admin/products?platform=${selected}&limit=100`, { headers: authHeader })
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [selected, token]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await fetch(`${API}/admin/platforms/sync`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Sync failed");
      const fetched = d.totalFetched ?? 0;
      setSyncMsg(`Fetched ${fetched} from Metenzi · synced ${d.synced ?? 0}${d.errors ? ` · ${d.errors} errors` : ""}`);
      loadStats();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function assignPlatform(variantId: number, platform: string) {
    await fetch(`${API}/admin/platforms/variant/${variantId}`, {
      method: "PATCH",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    });
    setProducts((prev) =>
      prev.map((p) => ({
        ...p,
        variants: p.variants.map((v) => v.id === variantId ? { ...v, platform } : v),
      })),
    );
    loadStats();
  }

  const statsMap = Object.fromEntries(stats.map((s) => [s.platform, s]));

  /* ── Drill-down: products for a selected platform ── */
  if (selected) {
    const meta = getPlatformMeta(selected);
    const stat = statsMap[selected];
    const allVariants = products.flatMap((p) =>
      p.variants.filter((v) => v.platform === selected).map((v) => ({ ...v, product: p })),
    );
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-[#8b94a8] hover:text-[#c8d0e0] transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Platforms
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: meta.bg, color: meta.color }}>{meta.icon}</div>
          <div>
            <h1 className="text-xl font-bold text-[#e2e8f0]">{meta.label}</h1>
            {stat && <p className="text-sm text-[#4a5568]">{stat.productCount} products · {stat.variantCount} variants</p>}
          </div>
        </div>
        <div className="rounded-lg border border-[#2e3340] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ background: "#1e2128" }}>
                {["Product", "SKU / Price", "Assign Platform", "Stock", "Status", ""].map((col) => (
                  <th key={col} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#4a5568]">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingProducts
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-4 py-3 border-t border-[#1f2330]"><div className="h-5 rounded animate-pulse bg-[#1e2128]" /></td></tr>
                  ))
                : allVariants.length === 0
                ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#4a5568]">No products found for this platform</td></tr>
                : allVariants.map((v) => (
                    <tr key={v.sku} className="border-t border-[#1f2330] hover:bg-[#1a1d28] transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#c8d0e0]">{v.product.name}</p>
                        <p className="text-xs text-[#4a5568]">/{v.product.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#8b94a8]">{v.sku}<br />${v.priceUsd}</td>
                      <td className="px-4 py-3">
                        <select
                          value={v.platform ?? "OTHER"}
                          onChange={(e) => assignPlatform(v.id, e.target.value)}
                          className="text-xs rounded px-2 py-1.5 border border-[#2e3340] bg-[#161920] text-[#c8d0e0] cursor-pointer focus:outline-none focus:border-[#3b82f6]"
                        >
                          {ALL_PLATFORMS.map((pl) => (
                            <option key={pl} value={pl}>{getPlatformMeta(pl).label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${v.stockCount === 0 ? "text-red-400" : v.stockCount < 5 ? "text-amber-400" : "text-green-400"}`}>{v.stockCount}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.product.isActive ? "bg-green-900/40 text-green-400" : "bg-[#1e2128] text-[#4a5568]"}`}>
                          {v.product.isActive ? "Active" : "Draft"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setLocation(`/admin/products/${v.product.id}`)} className="flex items-center gap-1 text-xs text-[#4a5568] hover:text-[#60a5fa] transition-colors ml-auto">
                          Edit <ChevronRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ── Overview ── */
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0]">Platforms</h1>
          <p className="text-sm text-[#4a5568] mt-1">Platform distribution across all products. Click a tile to browse and reassign variants.</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
            style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)" }}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync from Metenzi"}
          </button>
          {syncMsg && (
            <p className={`text-xs ${syncMsg.includes("error") ? "text-red-400" : "text-green-400"}`}>{syncMsg}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(PLATFORM_META).map(([key, meta]) => {
          const stat = statsMap[key];
          return (
            <button
              key={key}
              onClick={() => stat ? setSelected(key) : undefined}
              disabled={!stat}
              className="text-left rounded-lg border p-3 transition-all"
              style={{ background: stat ? meta.bg : "#0f1117", borderColor: stat ? `${meta.color}30` : "#1f2330", opacity: stat ? 1 : 0.35, cursor: stat ? "pointer" : "default" }}
              onMouseEnter={(e) => { if (stat) e.currentTarget.style.borderColor = `${meta.color}70`; }}
              onMouseLeave={(e) => { if (stat) e.currentTarget.style.borderColor = `${meta.color}30`; }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: `${meta.color}15`, color: meta.color }}>{meta.icon}</div>
                <span className="text-xs font-semibold text-[#c8d0e0] truncate">{meta.label}</span>
              </div>
              {loadingStats ? (
                <div className="h-3 rounded animate-pulse bg-[#1e2128] w-12" />
              ) : stat ? (
                <div>
                  <p className="text-base font-bold" style={{ color: meta.color }}>{stat.productCount}</p>
                  <p className="text-[10px] text-[#4a5568]">{stat.variantCount} var.</p>
                </div>
              ) : (
                <p className="text-xs text-[#2a2d3a]">–</p>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-[#2e3340] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2e3340]" style={{ background: "#1e2128" }}>
          <p className="text-xs font-bold uppercase tracking-wider text-[#4a5568]">Platform Distribution</p>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ background: "#161920" }}>
              <th className="px-4 py-2 text-left text-[11px] text-[#4a5568] font-semibold">Platform</th>
              <th className="px-4 py-2 text-right text-[11px] text-[#4a5568] font-semibold">Products</th>
              <th className="px-4 py-2 text-right text-[11px] text-[#4a5568] font-semibold">Variants</th>
              <th className="px-4 py-2 text-right text-[11px] text-[#4a5568] font-semibold">Share</th>
            </tr>
          </thead>
          <tbody>
            {loadingStats ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}><td colSpan={4} className="px-4 py-2.5 border-t border-[#1f2330]"><div className="h-4 rounded animate-pulse bg-[#1e2128]" /></td></tr>
              ))
            ) : stats.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <p className="text-sm text-[#4a5568]">No platform data yet.</p>
                  <p className="text-xs text-[#2a2d3a] mt-1">Run a Metenzi sync to populate automatically, or open a product and assign a platform manually.</p>
                </td>
              </tr>
            ) : (
              [...stats].sort((a, b) => b.variantCount - a.variantCount).map((s) => {
                const meta = getPlatformMeta(s.platform);
                const total = stats.reduce((sum, x) => sum + x.variantCount, 0);
                const pct = total > 0 ? Math.round((s.variantCount / total) * 100) : 0;
                return (
                  <tr key={s.platform} className="border-t border-[#1f2330] hover:bg-[#1a1d28] cursor-pointer transition-colors" onClick={() => setSelected(s.platform)}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span style={{ color: meta.color }}>{meta.icon}</span>
                        <span className="text-sm text-[#c8d0e0]">{meta.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm text-[#8b94a8]">{s.productCount}</td>
                    <td className="px-4 py-2.5 text-right text-sm text-[#8b94a8]">{s.variantCount}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-[#1f2330] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
                        </div>
                        <span className="text-xs text-[#4a5568] w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

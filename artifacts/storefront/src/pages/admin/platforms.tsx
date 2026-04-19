import { useState, useEffect } from "react";
import { Monitor, Apple, Terminal, Gamepad2, Package, ChevronRight, ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocation } from "wouter";

const API = import.meta.env.VITE_API_URL ?? "/api";

const PLATFORM_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  WINDOWS:     { label: "Windows",       icon: <Monitor className="h-5 w-5" />,   color: "#60a5fa", bg: "#0d1f3c" },
  MAC:         { label: "macOS",         icon: <Apple className="h-5 w-5" />,     color: "#a78bfa", bg: "#1a0d3c" },
  LINUX:       { label: "Linux",         icon: <Terminal className="h-5 w-5" />,  color: "#f59e0b", bg: "#2a1a00" },
  STEAM:       { label: "Steam",         icon: <Gamepad2 className="h-5 w-5" />,  color: "#4fc3f7", bg: "#001a2a" },
  ORIGIN:      { label: "EA App",        icon: <Gamepad2 className="h-5 w-5" />,  color: "#fb923c", bg: "#2a1000" },
  UPLAY:       { label: "Ubisoft",       icon: <Gamepad2 className="h-5 w-5" />,  color: "#60a5fa", bg: "#001028" },
  GOG:         { label: "GOG",           icon: <Gamepad2 className="h-5 w-5" />,  color: "#c084fc", bg: "#1a0028" },
  EPIC:        { label: "Epic Games",    icon: <Gamepad2 className="h-5 w-5" />,  color: "#e2e8f0", bg: "#1a1a1a" },
  XBOX:        { label: "Xbox",          icon: <Gamepad2 className="h-5 w-5" />,  color: "#4ade80", bg: "#001a0a" },
  PLAYSTATION: { label: "PlayStation",   icon: <Gamepad2 className="h-5 w-5" />,  color: "#60a5fa", bg: "#001028" },
  NINTENDO:    { label: "Nintendo",      icon: <Gamepad2 className="h-5 w-5" />,  color: "#f87171", bg: "#2a0000" },
  OTHER:       { label: "Other",         icon: <Package className="h-5 w-5" />,   color: "#94a3b8", bg: "#1a1d24" },
};

interface PlatformStat { platform: string; variantCount: number; productCount: number; }
interface ProductRow {
  id: number; name: string; slug: string; isActive: boolean;
  variants: { sku: string; platform: string | null; priceUsd: string; stockCount: number }[];
}

export default function AdminPlatformsPage() {
  const token = useAuthStore((s) => s.token);
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState<PlatformStat[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const h = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/admin/platforms/stats`, { headers: h })
      .then((r) => r.json())
      .then((d) => setStats(d.stats ?? []))
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [token]);

  useEffect(() => {
    if (!selected) return;
    setLoadingProducts(true);
    setProducts([]);
    fetch(`${API}/admin/products?platform=${selected}&limit=100`, { headers: h })
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [selected, token]);

  const allPlatforms = Object.keys(PLATFORM_META);
  const statsMap = Object.fromEntries(stats.map((s) => [s.platform, s]));

  if (selected) {
    const meta = PLATFORM_META[selected] ?? PLATFORM_META.OTHER;
    const stat = statsMap[selected];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-1.5 text-sm text-[#8b94a8] hover:text-[#c8d0e0] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Platforms
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: meta.bg, color: meta.color }}>
            {meta.icon}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#e2e8f0]">{meta.label}</h1>
            {stat && <p className="text-sm text-[#4a5568]">{stat.productCount} products · {stat.variantCount} variants</p>}
          </div>
        </div>

        <div className="rounded-lg border border-[#2e3340] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ background: "#1e2128" }}>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#4a5568]">Product</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#4a5568]">Variants</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#4a5568]">Stock</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#4a5568]">Status</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-[#4a5568]"></th>
              </tr>
            </thead>
            <tbody>
              {loadingProducts ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-3 border-t border-[#1f2330]">
                    <div className="h-5 rounded animate-pulse bg-[#1e2128]" />
                  </td></tr>
                ))
              ) : products.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#4a5568]">No products found</td></tr>
              ) : products.map((p) => {
                const pvs = p.variants.filter((v) => v.platform === selected);
                const stock = pvs.reduce((s, v) => s + v.stockCount, 0);
                return (
                  <tr key={p.id} className="border-t border-[#1f2330] hover:bg-[#1a1d28] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[#c8d0e0]">{p.name}</p>
                      <p className="text-xs text-[#4a5568]">/{p.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {pvs.map((v) => (
                          <div key={v.sku} className="text-xs text-[#8b94a8]">{v.sku} — ${v.priceUsd}</div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${stock === 0 ? "text-red-400" : stock < 5 ? "text-amber-400" : "text-green-400"}`}>
                        {stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? "bg-green-900/40 text-green-400" : "bg-[#1e2128] text-[#4a5568]"}`}>
                        {p.isActive ? "Active" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setLocation(`/admin/products/${p.id}`)}
                        className="flex items-center gap-1 text-xs text-[#4a5568] hover:text-[#60a5fa] transition-colors ml-auto"
                      >
                        Edit <ChevronRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#e2e8f0]">Platforms</h1>
        <p className="text-sm text-[#4a5568] mt-1">Product variants grouped by delivery platform</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {allPlatforms.map((key) => {
          const meta = PLATFORM_META[key];
          const stat = statsMap[key];
          return (
            <button
              key={key}
              onClick={() => stat ? setSelected(key) : undefined}
              disabled={!stat}
              className="text-left rounded-lg border p-4 transition-all"
              style={{
                background: stat ? meta.bg : "#0f1117",
                borderColor: stat ? `${meta.color}30` : "#1f2330",
                opacity: stat ? 1 : 0.45,
                cursor: stat ? "pointer" : "default",
              }}
              onMouseEnter={(e) => { if (stat) e.currentTarget.style.borderColor = `${meta.color}70`; }}
              onMouseLeave={(e) => { if (stat) e.currentTarget.style.borderColor = `${meta.color}30`; }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${meta.color}15`, color: meta.color }}>
                  {meta.icon}
                </div>
                <span className="text-sm font-semibold text-[#c8d0e0]">{meta.label}</span>
              </div>
              {loadingStats ? (
                <div className="space-y-1.5">
                  <div className="h-3 rounded animate-pulse bg-[#1e2128] w-16" />
                  <div className="h-3 rounded animate-pulse bg-[#1e2128] w-12" />
                </div>
              ) : stat ? (
                <div className="space-y-0.5">
                  <p className="text-lg font-bold" style={{ color: meta.color }}>{stat.productCount}</p>
                  <p className="text-[11px] text-[#4a5568]">{stat.variantCount} variant{stat.variantCount !== 1 ? "s" : ""}</p>
                </div>
              ) : (
                <p className="text-xs text-[#2a2d3a]">No products</p>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-[#2e3340] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2e3340]" style={{ background: "#1e2128" }}>
          <p className="text-xs font-bold uppercase tracking-wider text-[#4a5568]">Platform Summary</p>
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
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={4} className="px-4 py-2.5 border-t border-[#1f2330]">
                  <div className="h-4 rounded animate-pulse bg-[#1e2128]" />
                </td></tr>
              ))
            ) : (
              [...stats]
                .sort((a, b) => b.variantCount - a.variantCount)
                .map((s) => {
                  const meta = PLATFORM_META[s.platform] ?? PLATFORM_META.OTHER;
                  const totalVariants = stats.reduce((sum, x) => sum + x.variantCount, 0);
                  const pct = totalVariants > 0 ? Math.round((s.variantCount / totalVariants) * 100) : 0;
                  return (
                    <tr
                      key={s.platform}
                      className="border-t border-[#1f2330] hover:bg-[#1a1d28] cursor-pointer transition-colors"
                      onClick={() => setSelected(s.platform)}
                    >
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

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Package, Plus, Search, Copy, Trash2, Pencil, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminBundle } from "./bundle-types";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface BundleAnalytics { bundleId: number; name: string; itemCount: number; purchases: number; revenue: string; }

export default function AdminBundlesPage() {
  const token = useAuthStore((s) => s.token);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [bundles, setBundles] = useState<AdminBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Bundles</h1>
        <button
          onClick={() => setLocation("/admin/bundles/new")}
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
              <tr
                key={b.id}
                onClick={() => setLocation(`/admin/bundles/${b.id}/edit`)}
                className={`cursor-pointer ${i % 2 === 0 ? "bg-[#0c1018]" : "bg-[#0f1520]"} hover:bg-[#111825]`}
              >
                <td className="px-3 py-[6px] text-[12.5px] text-[#dde4f0] border-b border-[#1f2840]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-[#1e2128] flex items-center justify-center overflow-hidden">
                      {b.imageUrl ? <img src={b.imageUrl} className="w-full h-full object-cover rounded" /> : <Package className="h-5 w-5 text-[#5a6a84]" />}
                    </div>
                    <div>
                      <p className="font-medium text-[#dde4f0]">{b.name}</p>
                      <p className="text-xs text-[#5a6a84]">/{b.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-[6px] text-[12.5px] text-[#dde4f0] border-b border-[#1f2840]"><Badge variant="secondary">{b.items.length} products</Badge></td>
                <td className="px-3 py-[6px] text-[12.5px] text-[#dde4f0] border-b border-[#1f2840] font-medium">€{b.bundlePriceUsd}</td>
                <td className="px-3 py-[6px] text-[12.5px] text-[#dde4f0] border-b border-[#1f2840]">
                  <div className="flex gap-1">
                    {b.isActive ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="secondary">Draft</Badge>}
                    {b.isFeatured && <Badge className="bg-amber-100 text-amber-800">Featured</Badge>}
                  </div>
                </td>
                <td className="px-3 py-[6px] text-[12.5px] text-[#dde4f0] border-b border-[#1f2840] text-right">
                  <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => viewAnalytics(b.id)} title="Analytics"><BarChart3 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setLocation(`/admin/bundles/${b.id}/edit`)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => duplicate(b.id)} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(b.id)} title="Delete"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {analytics && (
        <Dialog open={!!analytics} onOpenChange={() => setAnalytics(null)}>
          <DialogContent className="max-w-sm bg-[#181c24] border-[#2e3340] text-[#dde4f0]">
            <DialogHeader><DialogTitle className="text-[#dde4f0]">Bundle Analytics</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <p className="font-medium text-[#dde4f0]">{analytics.name}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[#2e3340] bg-[#0f1117] p-3 text-center">
                  <p className="text-2xl font-bold text-[#dde4f0]">{analytics.purchases}</p>
                  <p className="text-xs text-[#5a6a84]">Orders</p>
                </div>
                <div className="rounded-lg border border-[#2e3340] bg-[#0f1117] p-3 text-center">
                  <p className="text-2xl font-bold text-[#dde4f0]">€{analytics.revenue}</p>
                  <p className="text-xs text-[#5a6a84]">Revenue</p>
                </div>
              </div>
              <p className="text-xs text-[#5a6a84]">{analytics.itemCount} products in bundle</p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

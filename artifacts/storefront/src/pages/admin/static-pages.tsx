import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, Eye, EyeOff, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface PageRow {
  id: number; title: string; slug: string; isPublished: boolean;
  sortOrder: number; updatedAt: string; metaTitle: string | null; metaDescription: string | null;
}

export default function AdminStaticPagesPage() {
  const [rows, setRows] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();
  const token = useAuthStore((s) => s.token);

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) { const e = await r.json().catch(() => ({ error: "Failed" })); alert(e.error); return null; }
    return r.json();
  }, [token]);

  const load = useCallback(() => {
    setLoading(true);
    api("/admin/pages").then((d) => { if (d) setRows(d.pages); }).finally(() => setLoading(false));
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const seed = async () => {
    const r = await api("/admin/pages/seed", { method: "POST" });
    if (r) { alert(`Seeded ${r.seeded} pages`); load(); }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this page?")) return;
    const r = await api(`/admin/pages/${id}`, { method: "DELETE" });
    if (r) load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Static Pages</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={seed}><Sprout className="h-4 w-4 mr-1" /> Seed Defaults</Button>
          <Button size="sm" onClick={() => navigate("/admin/pages/new")}><Plus className="h-4 w-4 mr-1" /> New Page</Button>
        </div>
      </div>
      {loading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div> : rows.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center text-muted-foreground">No pages yet. Click "Seed Defaults" to create starter pages.</div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50 text-left text-xs font-medium text-muted-foreground uppercase">
              <th className="px-4 py-3">Title</th><th className="px-4 py-3">Slug</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3 text-right">Actions</th>
            </tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.title}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">/{p.slug}</td>
                <td className="px-4 py-3">{p.isPublished ? <Badge className="bg-green-100 text-green-700 text-xs">Published</Badge> : <Badge variant="secondary" className="text-xs">Draft</Badge>}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(p.updatedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right space-x-1">
                  <button className="p-1.5 hover:bg-gray-100 rounded" onClick={() => navigate(`/admin/pages/${p.id}`)}><Pencil className="h-4 w-4" /></button>
                  <button className="p-1.5 hover:bg-gray-100 rounded" onClick={() => window.open(`/page/${p.slug}`, "_blank")}>{p.isPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}</button>
                  <button className="p-1.5 hover:bg-red-50 rounded text-red-500" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

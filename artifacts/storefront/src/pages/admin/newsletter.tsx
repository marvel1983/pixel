import { useEffect, useState, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight, Trash2, Download, Upload, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Subscriber {
  id: number; email: string; status: string; source: string;
  discountCode: string | null; confirmedAt: string | null;
  createdAt: string;
}
interface Stats { pending: number; confirmed: number; unsubscribed: number; total: number }
interface NLSettings {
  enabled: boolean; doubleOptIn: boolean; exitIntentEnabled: boolean;
  exitIntentDiscount: number; exitIntentHeadline: string; exitIntentBody: string;
  mailchimpApiKey: string | null; mailchimpListId: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-green-100 text-green-800",
  UNSUBSCRIBED: "bg-red-100 text-red-800",
};

export default function AdminNewsletterPage() {
  const [tab, setTab] = useState<"subscribers" | "settings">("subscribers");
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({ pending: 0, confirmed: 0, unsubscribed: 0, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [settings, setSettings] = useState<NLSettings | null>(null);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const limit = 25;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (status !== "ALL") params.set("status", status);
    Promise.all([
      fetch(`${API}/admin/newsletter/subscribers?${params}`, { headers }).then((r) => r.json()),
      fetch(`${API}/admin/newsletter/stats`, { headers }).then((r) => r.json()),
    ]).then(([d, s]) => {
      setRows(d.subscribers || []);
      setTotal(d.total || 0);
      setStats(s);
    }).finally(() => setLoading(false));
  }, [page, search, status, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (tab === "settings" && !settings) {
      fetch(`${API}/admin/newsletter/settings`, { headers })
        .then((r) => r.json()).then((d) => setSettings(d.settings));
    }
  }, [tab]);

  const deleteRow = async (id: number) => {
    const r = await fetch(`${API}/admin/newsletter/subscribers/${id}`, { method: "DELETE", headers });
    if (!r.ok) { toast({ title: "Error", description: "Delete failed", variant: "destructive" }); return; }
    fetchData();
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    const r = await fetch(`${API}/admin/newsletter/bulk-delete`, { method: "POST", headers, body: JSON.stringify({ ids }) });
    if (!r.ok) { toast({ title: "Error", description: "Bulk delete failed", variant: "destructive" }); return; }
    setSelected(new Set());
    fetchData();
  };

  const handleExport = async () => {
    try {
      const r = await fetch(`${API}/admin/newsletter/export`, { headers });
      if (!r.ok) throw new Error("Export failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "newsletter-subscribers.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch { toast({ title: "Export failed", variant: "destructive" }); }
  };

  const handleImport = async () => {
    const emails = importText.split(/[\n,;]+/).map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) return;
    const r = await fetch(`${API}/admin/newsletter/import`, { method: "POST", headers, body: JSON.stringify({ emails }) });
    const d = await r.json();
    toast({ title: "Import complete", description: `${d.imported} new subscribers added.` });
    setImportText(""); setShowImport(false); fetchData();
  };

  const saveSettings = async () => {
    if (!settings) return;
    const r = await fetch(`${API}/admin/newsletter/settings`, { method: "PUT", headers, body: JSON.stringify(settings) });
    if (r.ok) toast({ title: "Settings saved" });
    else toast({ title: "Error", description: "Save failed", variant: "destructive" });
  };

  const toggleSelect = (id: number) => {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Newsletter</h1>
        <div className="flex gap-2">
          <Button size="sm" variant={tab === "subscribers" ? "default" : "outline"} onClick={() => setTab("subscribers")}>Subscribers</Button>
          <Button size="sm" variant={tab === "settings" ? "default" : "outline"} onClick={() => setTab("settings")}><Settings2 className="h-4 w-4 mr-1" />Settings</Button>
        </div>
      </div>

      {tab === "subscribers" && <SubscribersTab />}
      {tab === "settings" && settings && <SettingsTab />}
    </div>
  );

  function SubscribersTab() {
    return (
      <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Pending", value: stats.pending, color: "text-yellow-600" },
            { label: "Confirmed", value: stats.confirmed, color: "text-green-600" },
            { label: "Unsubscribed", value: stats.unsubscribed, color: "text-red-600" },
            { label: "Total", value: stats.total, color: "text-blue-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border bg-white p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input className="w-full border rounded-md pl-9 pr-3 py-2 text-sm" placeholder="Search by email..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="border rounded-md px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="UNSUBSCRIBED">Unsubscribed</option>
          </select>
          {selected.size > 0 && (
            <Button size="sm" variant="destructive" onClick={bulkDelete}>Delete ({selected.size})</Button>
          )}
          <Button size="sm" variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
          <Button size="sm" variant="outline" onClick={() => setShowImport(!showImport)}><Upload className="h-4 w-4 mr-1" />Import</Button>
        </div>

        {showImport && (
          <div className="rounded-lg border bg-white p-4 space-y-2">
            <p className="text-sm font-medium">Import emails (one per line or comma-separated)</p>
            <Textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={4} placeholder="email@example.com" />
            <Button size="sm" onClick={handleImport}>Import</Button>
          </div>
        )}

        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="p-3 w-8"><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Source</th>
                <th className="p-3 text-left">Discount</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="p-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                  <td className="p-3 font-medium">{r.email}</td>
                  <td className="p-3"><Badge className={STATUS_COLORS[r.status]}>{r.status}</Badge></td>
                  <td className="p-3 text-muted-foreground">{r.source}</td>
                  <td className="p-3 text-muted-foreground">{r.discountCode || "-"}</td>
                  <td className="p-3 text-muted-foreground text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="p-3">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => deleteRow(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No subscribers found</td></tr>}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {page} of {pages} ({total} subscribers)</p>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </>
    );
  }

  function SettingsTab() {
    if (!settings) return null;
    const update = (field: keyof NLSettings, value: NLSettings[keyof NLSettings]) => {
      setSettings({ ...settings, [field]: value });
    };
    return (
      <div className="rounded-lg border bg-white p-6 space-y-6 max-w-2xl">
        <div className="space-y-4">
          <h3 className="font-semibold">General</h3>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={settings.enabled} onChange={(e) => update("enabled", e.target.checked)} />
            <span className="text-sm">Enable newsletter subscriptions</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={settings.doubleOptIn} onChange={(e) => update("doubleOptIn", e.target.checked)} />
            <span className="text-sm">Double opt-in (send confirmation email)</span>
          </label>
        </div>

        <div className="space-y-4 border-t pt-4">
          <h3 className="font-semibold">Exit-Intent Popup</h3>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={settings.exitIntentEnabled} onChange={(e) => update("exitIntentEnabled", e.target.checked)} />
            <span className="text-sm">Enable exit-intent popup</span>
          </label>
          <div>
            <label className="text-sm text-muted-foreground">Discount %</label>
            <Input type="number" value={settings.exitIntentDiscount} onChange={(e) => update("exitIntentDiscount", parseInt(e.target.value) || 0)} className="mt-1 max-w-[120px]" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Headline</label>
            <Input value={settings.exitIntentHeadline} onChange={(e) => update("exitIntentHeadline", e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Body text</label>
            <Input value={settings.exitIntentBody} onChange={(e) => update("exitIntentBody", e.target.value)} className="mt-1" />
          </div>
        </div>

        <div className="space-y-4 border-t pt-4">
          <h3 className="font-semibold">Mailchimp (optional)</h3>
          <div>
            <label className="text-sm text-muted-foreground">API Key</label>
            <Input type="password" value={settings.mailchimpApiKey || ""} onChange={(e) => update("mailchimpApiKey", e.target.value || null)} className="mt-1" placeholder="Enter API key..." />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">List ID</label>
            <Input value={settings.mailchimpListId || ""} onChange={(e) => update("mailchimpListId", e.target.value || null)} className="mt-1" placeholder="Enter list/audience ID..." />
          </div>
        </div>

        <Button onClick={saveSettings}>Save Settings</Button>
      </div>
    );
  }
}

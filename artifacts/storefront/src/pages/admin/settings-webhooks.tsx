import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Webhook, AlertCircle, CheckCircle, X, Copy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface WebhookItem { id: string; url: string; events: string[]; isActive: boolean; }

export default function SettingsWebhooksTab() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [autoRegistering, setAutoRegistering] = useState(false);
  const [autoRegResult, setAutoRegResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [recentLogs, setRecentLogs] = useState<{ ts: string; event: string; outcome: string; status: number; error?: string }[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const token = useAuthStore((s) => s.token);

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) { const e = await r.json().catch(() => ({ error: "Failed" })); throw new Error(e.error); }
    return r.json();
  }, [token]);

  const load = useCallback(async () => {
    try {
      const d = await api("/admin/settings/webhooks");
      setWebhooks(d.webhooks); setEvents(d.events); setConfigured(d.configured);
      if (d.error) setError(d.error);
      const ep = await api("/admin/settings/webhooks/endpoint-url");
      setEndpointUrl(ep.url);
    } catch (e) { setError((e as Error).message); }
    setLoaded(true);
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setShowAdd(true); setNewUrl(endpointUrl); setSelectedEvents([]); };

  const toggleEvent = (ev: string) => {
    setSelectedEvents((p) => p.includes(ev) ? p.filter((e) => e !== ev) : [...p, ev]);
  };

  const register = async () => {
    if (!newUrl.trim() || selectedEvents.length === 0) return;
    setSaving(true);
    try {
      const wh = await api("/admin/settings/webhooks", { method: "POST", body: JSON.stringify({ url: newUrl.trim(), events: selectedEvents }) });
      setWebhooks((p) => [...p, wh]); setShowAdd(false);
    } catch (e) { alert((e as Error).message); }
    setSaving(false);
  };

  const doDelete = async (id: string) => {
    try {
      await api(`/admin/settings/webhooks/${id}`, { method: "DELETE" });
      setWebhooks((p) => p.filter((w) => w.id !== id));
    } catch (e) { alert((e as Error).message); }
    setConfirmDelete(null);
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try { const d = await api("/admin/settings/webhook-logs"); setRecentLogs(d.logs ?? []); } catch { /* ignore */ }
    setLogsLoading(false);
  };

  if (!loaded) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  if (!configured) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-5 space-y-2">
        <div className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-yellow-600" /><h3 className="font-semibold text-yellow-800">Metenzi API Not Configured</h3></div>
        <p className="text-sm text-yellow-700">Configure your Metenzi API key and signing secret in the API Keys tab before managing webhooks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {error}</div>}

      <div className="rounded-lg border bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2"><Webhook className="h-5 w-5 text-blue-600" /><h3 className="font-semibold">Registered Webhooks</h3></div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" disabled={autoRegistering} onClick={async () => {
              setAutoRegistering(true); setAutoRegResult(null);
              try {
                await api("/webhooks/metenzi/register", { method: "POST" });
                setAutoRegResult({ ok: true, msg: "Webhook registered successfully" });
                await load();
              } catch (e) { setAutoRegResult({ ok: false, msg: (e as Error).message }); }
              setAutoRegistering(false);
            }}><Zap className="h-3 w-3 mr-1" />{autoRegistering ? "Registering..." : "Auto-register Metenzi"}</Button>
            <Button size="sm" onClick={openAdd}><Plus className="h-3 w-3 mr-1" /> Custom</Button>
          </div>
        </div>
        {autoRegResult && (
          <p className={`text-xs ${autoRegResult.ok ? "text-green-600" : "text-red-600"}`}>{autoRegResult.msg}</p>
        )}
        <div className="rounded-md border bg-gray-50 p-3 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Your endpoint:</span>
          <code className="font-mono bg-white px-2 py-0.5 rounded border flex-1 truncate">{endpointUrl}</code>
          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(endpointUrl); }}><Copy className="h-3 w-3" /></Button>
        </div>

        {webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No webhooks registered yet.</p>
        ) : (
          <div className="space-y-3">
            {webhooks.map((w) => (
              <div key={w.id} className="border rounded-md p-4 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {w.isActive ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-yellow-500" />}
                    <code className="text-xs font-mono break-all">{w.url}</code>
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(w.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <div className="flex flex-wrap gap-1">{w.events.map((e) => <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>)}</div>
                <div className="flex items-center gap-2"><Badge variant={w.isActive ? "default" : "secondary"}>{w.isActive ? "Active" : "Inactive"}</Badge><span className="text-xs text-muted-foreground">ID: {w.id}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold">Register Webhook</h3><button onClick={() => setShowAdd(false)}><X className="h-5 w-5" /></button></div>
            <div><label className="block text-sm font-medium mb-1">Webhook URL</label><input className="w-full rounded-md border px-3 py-2 text-sm font-mono" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-2">Events</label>
              <div className="grid grid-cols-2 gap-2">{events.map((ev) => (
                <label key={ev} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={selectedEvents.includes(ev)} onChange={() => toggleEvent(ev)} className="rounded" /><span className="font-mono text-xs">{ev}</span>
                </label>
              ))}</div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={register} disabled={saving || !newUrl.trim() || selectedEvents.length === 0}>{saving ? "Registering..." : "Register"}</Button></div>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Recent Incoming Events</h3>
          <Button size="sm" variant="outline" onClick={loadLogs} disabled={logsLoading}>{logsLoading ? "Loading…" : "Refresh Logs"}</Button>
        </div>
        {recentLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Click "Refresh Logs" to see recent webhook activity (in-memory, last 50).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-gray-50 text-left"><th className="px-2 py-1 border">Time</th><th className="px-2 py-1 border">Event</th><th className="px-2 py-1 border">Status</th><th className="px-2 py-1 border">Outcome</th><th className="px-2 py-1 border">Error</th></tr></thead>
              <tbody>{recentLogs.slice(0, 20).map((l, i) => (
                <tr key={i} className={l.outcome === "ok" ? "bg-green-50" : l.outcome === "challenge" ? "bg-blue-50" : "bg-red-50"}>
                  <td className="px-2 py-1 border font-mono whitespace-nowrap">{new Date(l.ts).toLocaleTimeString()}</td>
                  <td className="px-2 py-1 border font-mono">{l.event}</td>
                  <td className="px-2 py-1 border">{l.status}</td>
                  <td className="px-2 py-1 border">{l.outcome}</td>
                  <td className="px-2 py-1 border text-red-600 max-w-xs truncate">{l.error ?? ""}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">Delete Webhook</h3>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete this webhook? This will unregister it from the Metenzi API.</p>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button><Button variant="destructive" onClick={() => doDelete(confirmDelete)}>Delete</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

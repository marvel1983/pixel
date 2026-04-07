import { useEffect, useState, useCallback } from "react";
import { Save, MessageCircle, Code, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function SettingsLiveChatTab() {
  const [enabled, setEnabled] = useState(false);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const token = useAuthStore((s) => s.token);

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) { const e = await r.json().catch(() => ({ error: "Failed" })); alert(e.error); return null; }
    return r.json();
  }, [token]);

  useEffect(() => {
    api("/admin/settings/live-chat").then((d) => { if (d) { setEnabled(d.liveChatEnabled); setCode(d.liveChatCode || ""); } setLoaded(true); });
  }, [api]);

  const save = async () => {
    setSaving(true);
    await api("/admin/settings/live-chat", { method: "PUT", body: JSON.stringify({ liveChatEnabled: enabled, liveChatCode: code }) });
    setSaving(false);
    alert("Live chat settings saved!");
  };

  if (!loaded) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-5 space-y-4">
        <div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-blue-600" /><h3 className="font-semibold">Live Chat Widget</h3></div>
        <p className="text-xs text-muted-foreground">Enable a third-party live chat widget on your storefront. Paste the embed code from providers like Tawk.to, Crisp, Intercom, LiveChat, or Zendesk.</p>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="rounded" />
          <span className="text-sm font-medium">Enable live chat on storefront</span>
          <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Active" : "Disabled"}</Badge>
        </label>
      </div>

      {enabled && (
        <div className="rounded-lg border bg-white p-5 space-y-4">
          <div className="flex items-center gap-2"><Code className="h-5 w-5 text-gray-600" /><h3 className="font-semibold">Embed Code</h3></div>
          <p className="text-xs text-muted-foreground">Paste your chat widget's embed code below. This will be injected into the storefront footer. Only <code>&lt;script&gt;</code> tags are supported.</p>

          <textarea className="w-full rounded-md border px-3 py-2 text-sm font-mono min-h-[160px] resize-y bg-gray-50" value={code} onChange={(e) => setCode(e.target.value)} placeholder={'<!-- Tawk.to example -->\n<script type="text/javascript">\nvar Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();\n(function(){\nvar s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];\ns1.async=true;\ns1.src=\'https://embed.tawk.to/YOUR_ID/default\';\ns1.charset=\'UTF-8\';\ns0.parentNode.insertBefore(s1,s0);\n})();\n</script>'} />

          {code.trim() && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{code.length} characters</span>
              {code.includes("<script") && <Badge variant="default" className="text-xs">Script detected</Badge>}
              {!code.includes("<script") && <Badge variant="secondary" className="text-xs">No script tag found</Badge>}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-3 w-3 mr-1" /> {showPreview ? "Hide" : "Show"} Code Preview
          </Button>

          {showPreview && code.trim() && (
            <div className="bg-gray-900 text-green-400 rounded-md p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-[200px] overflow-y-auto">{code}</div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
        <h4 className="text-sm font-medium text-blue-800">Supported Providers</h4>
        <div className="grid grid-cols-3 gap-2 text-xs text-blue-700">
          {["Tawk.to", "Crisp", "Intercom", "LiveChat", "Zendesk", "Drift", "Tidio", "Olark", "HubSpot Chat", "Freshchat"].map((p) => (
            <span key={p} className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{p}</span>
          ))}
        </div>
        <p className="text-xs text-blue-600 mt-1">Any provider that gives you an embed snippet will work.</p>
      </div>

      <div className="flex justify-end"><Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Settings"}</Button></div>
    </div>
  );
}

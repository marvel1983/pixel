import { useState, useEffect } from "react";
import { Loader2, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface TrustpilotSettings {
  enabled: boolean;
  businessUnitId: string;
  trustpilotUrl: string;
  hasApiKey: boolean;
  inviteDelayDays: number;
  cachedRating: number;
  cachedCount: number;
}

const DEFAULT: TrustpilotSettings = {
  enabled: false, businessUnitId: "", trustpilotUrl: "",
  hasApiKey: false, inviteDelayDays: 3, cachedRating: 4.7, cachedCount: 2847,
};

export default function SettingsTrustpilotTab() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [form, setForm] = useState<TrustpilotSettings>(DEFAULT);
  const [apiKey, setApiKey] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testName, setTestName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    fetch(`${API}/admin/trustpilot`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d.settings) setForm(d.settings); })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSave() {
    setSaving(true);
    const body: Record<string, unknown> = { ...form };
    if (apiKey) body.apiKey = apiKey;
    await fetch(`${API}/admin/trustpilot`, { method: "PUT", headers, body: JSON.stringify(body) });
    setApiKey("");
    toast({ title: "Trustpilot settings saved" });
    setSaving(false);
  }

  async function handleClearKey() {
    await fetch(`${API}/admin/trustpilot/clear-api-key`, { method: "POST", headers });
    setForm((p) => ({ ...p, hasApiKey: false }));
    toast({ title: "API key cleared" });
  }

  async function handleTestInvite() {
    if (!testEmail || !testName) return;
    setTesting(true);
    const res = await fetch(`${API}/admin/trustpilot/test-invite`, {
      method: "POST", headers, body: JSON.stringify({ email: testEmail, name: testName }),
    });
    const data = await res.json();
    toast({ title: res.ok ? "Test invite sent!" : data.error, variant: res.ok ? "default" : "destructive" });
    setTesting(false);
  }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-100">
        <span className="bg-green-500 text-white px-1.5 py-0.5 rounded text-sm font-bold">★</span>
        <span className="font-semibold">Trustpilot Integration</span>
      </div>

      <div className="space-y-4">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} className="rounded" />
          <span className="text-sm font-medium">Enable Trustpilot widgets</span>
        </label>

        <div>
          <label className="text-sm font-medium">Business Unit ID</label>
          <Input value={form.businessUnitId} onChange={(e) => setForm((p) => ({ ...p, businessUnitId: e.target.value }))} placeholder="e.g. 5f1234567890abcdef" className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">Find this in your Trustpilot Business dashboard</p>
        </div>

        <div>
          <label className="text-sm font-medium">Trustpilot Profile URL</label>
          <Input value={form.trustpilotUrl} onChange={(e) => setForm((p) => ({ ...p, trustpilotUrl: e.target.value }))} placeholder="https://www.trustpilot.com/review/yoursite.com" className="mt-1" />
        </div>

        <div>
          <label className="text-sm font-medium">API Key {form.hasApiKey && <span className="text-green-600 text-xs">(saved)</span>}</label>
          <div className="flex gap-2 mt-1">
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={form.hasApiKey ? "••••••••" : "Enter API key"} className="flex-1" />
            {form.hasApiKey && (
              <Button variant="outline" size="icon" onClick={handleClearKey}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Used for sending review invitation emails</p>
        </div>

        <div>
          <label className="text-sm font-medium">Review Invite Delay (days)</label>
          <Input type="number" min={1} max={30} value={form.inviteDelayDays}
            onChange={(e) => setForm((p) => ({ ...p, inviteDelayDays: parseInt(e.target.value) || 3 }))} className="mt-1 w-32" />
          <p className="text-xs text-muted-foreground mt-1">Days after order completion before sending review invite</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Cached Rating</label>
            <Input type="number" min={0} max={5} step={0.1} value={form.cachedRating}
              onChange={(e) => setForm((p) => ({ ...p, cachedRating: parseFloat(e.target.value) || 4.7 }))} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Cached Review Count</label>
            <Input type="number" min={0} value={form.cachedCount}
              onChange={(e) => setForm((p) => ({ ...p, cachedCount: parseInt(e.target.value) || 0 }))} className="mt-1" />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground -mt-2">Fallback values when Trustpilot widget can't load (ad-blocker)</p>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}Save Settings
        </Button>
      </div>

      {form.hasApiKey && (
        <div className="border-t pt-6 space-y-3">
          <h3 className="font-medium">Test Review Invite</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Customer name" value={testName} onChange={(e) => setTestName(e.target.value)} />
            <Input type="email" placeholder="Customer email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          </div>
          <Button variant="outline" onClick={handleTestInvite} disabled={testing || !testEmail || !testName}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}Send Test Invite
          </Button>
        </div>
      )}
    </div>
  );
}

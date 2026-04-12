import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2, Eye, EyeOff, Shield, ExternalLink } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

const inputCls = "w-full rounded border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const labelCls = "block text-[11.5px] font-medium text-[#8fa0bb] mb-1";

export default function SettingsGoogleTab() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [hasSecret, setHasSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    fetch(`${API}/admin/settings/google-oauth`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        setEnabled(d.enabled);
        setClientId(d.clientId ?? "");
        setHasSecret(d.hasSecret);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { enabled, clientId };
      if (clientSecret) body.clientSecret = clientSecret;
      const res = await fetch(`${API}/admin/settings/google-oauth`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      setClientSecret("");
      if (clientSecret) setHasSecret(true);
      toast({ title: "Google OAuth settings saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API}/admin/settings/google-oauth/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, message: "Failed to reach server" });
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <DarkCard
        title="Google OAuth Settings"
        description="Allow users to sign in with their Google account."
      >
        <div className="text-[12px] text-[#5a6a84]">
          You need to create OAuth credentials in the{" "}
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline inline-flex items-center gap-1">
            Google Cloud Console <ExternalLink className="h-3 w-3" />
          </a>.
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#dde4f0] flex items-center gap-2"><Shield className="h-4 w-4" /> Enable Google Sign-In</p>
            <p className="text-[12px] text-[#5a6a84]">Show "Continue with Google" on login and register pages</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="clientId" className={labelCls}>Client ID</label>
            <input
              id="clientId"
              className={inputCls}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="xxx.apps.googleusercontent.com"
            />
          </div>
          <div>
            <label htmlFor="clientSecret" className={labelCls}>
              Client Secret {hasSecret && !clientSecret && <span className="text-xs text-[#5a6a84] ml-1">(saved, enter new value to change)</span>}
            </label>
            <div className="relative">
              <input
                id="clientSecret"
                className={inputCls + " pr-10"}
                type={showSecret ? "text" : "password"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={hasSecret ? "Enter new secret to update" : "Enter client secret"}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a6a84] hover:text-[#dde4f0]" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-[#2a2e3a] pt-4">
          <p className="text-[12px] text-[#5a6a84] mb-2">
            Set the authorized redirect URI in Google Console to:
          </p>
          <code className="text-xs bg-[#0f1117] border border-[#2e3340] px-2 py-1 rounded block overflow-x-auto text-[#dde4f0]">
            {window.location.origin}/api/auth/google/callback
          </code>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded border border-sky-500 bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Settings
          </button>
          <button
            onClick={handleTest}
            disabled={testing || !hasSecret}
            className="flex items-center gap-2 rounded border border-[#2e3340] bg-[#1e2128] px-4 py-2 text-[13px] font-semibold text-[#dde4f0] hover:bg-[#2a2e3a] disabled:opacity-50 transition-colors"
          >
            {testing && <Loader2 className="h-4 w-4 animate-spin" />}
            Test Connection
          </button>
        </div>
        {testResult && (
          <p className={`text-sm mt-2 ${testResult.success ? "text-green-400" : "text-red-400"}`}>
            {testResult.message}
          </p>
        )}
      </DarkCard>
    </div>
  );
}

function DarkCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
      <div className="border-b border-[#2a2e3a] px-4 py-3 bg-[#1e2128]">
        <p className="card-title text-[13px] font-bold uppercase tracking-widest">{title}</p>
        {description && <p className="mt-0.5 text-[11px] text-[#5a6a84]">{description}</p>}
      </div>
      <div className="px-4 py-4 space-y-4">{children}</div>
    </div>
  );
}

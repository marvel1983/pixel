import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2, Eye, EyeOff, Shield, ExternalLink } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

const inputCls = "w-full rounded border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const labelCls = "block text-[11.5px] font-medium text-[#8fa0bb] mb-1";

export default function SettingsTurnstileTab() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [siteKey, setSiteKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [hasSecret, setHasSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    fetch(`${API}/admin/settings/turnstile`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        setEnabled(d.enabled);
        setSiteKey(d.siteKey ?? "");
        setHasSecret(d.hasSecret);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { enabled, siteKey };
      if (secretKey) body.secretKey = secretKey;
      const res = await fetch(`${API}/admin/settings/turnstile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSecretKey("");
      if (secretKey) setHasSecret(true);
      toast({ title: "Turnstile settings saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <DarkCard
        title="Cloudflare Turnstile"
        description="Bot protection CAPTCHA on the login page."
      >
        <div className="text-[12px] text-[#5a6a84]">
          Get your keys from the{" "}
          <a href="https://dash.cloudflare.com/?to=/:account/turnstile" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline inline-flex items-center gap-1">
            Cloudflare Turnstile dashboard <ExternalLink className="h-3 w-3" />
          </a>.
          Set the widget type to <strong className="text-[#dde4f0]">Managed</strong> for best UX.
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#dde4f0] flex items-center gap-2"><Shield className="h-4 w-4" /> Enable Turnstile on Login</p>
            <p className="text-[12px] text-[#5a6a84]">Shows the CAPTCHA widget on the login page</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="siteKey" className={labelCls}>Site Key (public)</label>
            <input
              id="siteKey"
              className={inputCls}
              value={siteKey}
              onChange={(e) => setSiteKey(e.target.value)}
              placeholder="0x4AAAAAAA..."
            />
          </div>
          <div>
            <label htmlFor="secretKey" className={labelCls}>
              Secret Key {hasSecret && !secretKey && <span className="text-xs text-[#5a6a84] ml-1">(saved, enter new value to change)</span>}
            </label>
            <div className="relative">
              <input
                id="secretKey"
                className={inputCls + " pr-10"}
                type={showSecret ? "text" : "password"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={hasSecret ? "Enter new secret to update" : "0x4AAAAAAA..."}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a6a84] hover:text-[#dde4f0]" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded border border-sky-500 bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Settings
        </button>
      </DarkCard>
    </div>
  );
}

function DarkCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}>
      <div className="border-b border-[#2a2e3a] px-4 py-3 bg-[#1e2128]">
        <p className="card-title text-[13px] font-bold uppercase tracking-widest">{title}</p>
        {description && <p className="mt-0.5 text-[11px] text-[#5a6a84]">{description}</p>}
      </div>
      <div className="px-4 py-4 space-y-4">{children}</div>
    </div>
  );
}

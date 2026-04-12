import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

const inputCls = "w-full rounded border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const labelCls = "block text-[11.5px] font-medium text-[#8fa0bb] mb-1";

interface Settings {
  enabled: boolean;
  minCartValue: string;
  email1DelayMinutes: number;
  email2DelayMinutes: number;
  email3DelayMinutes: number;
  discountPercent: number;
  expirationDays: number;
}

export default function AbandonedCartSettingsPage() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/admin/abandoned-cart-settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .catch(() => toast({ title: "Failed to load settings", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [token]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/abandoned-cart-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!settings) return <p className="text-center text-[#5a6a84] py-12">Failed to load settings</p>;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings({ ...settings, [key]: value });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Abandoned Cart Settings</h1>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded border border-sky-500 bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DarkCard title="General" description="Enable or disable abandoned cart recovery">
          <div className="flex items-center justify-between">
            <label className={labelCls + " mb-0"}>Recovery Enabled</label>
            <Switch checked={settings.enabled} onCheckedChange={(v) => update("enabled", v)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Minimum Cart Value ($)</label>
            <input className={inputCls} type="number" min="0" step="0.01" value={settings.minCartValue}
              onChange={(e) => update("minCartValue", e.target.value)} />
          </div>
        </DarkCard>

        <DarkCard title="Email Timing" description="Delay in minutes before each email is sent">
          <div className="space-y-1">
            <label className={labelCls}>Email 1 Delay (minutes)</label>
            <input className={inputCls} type="number" min="1" value={settings.email1DelayMinutes}
              onChange={(e) => update("email1DelayMinutes", parseInt(e.target.value) || 60)} />
            <p className="text-xs text-[#5a6a84]">Default: 60 min (1 hour)</p>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Email 2 Delay (minutes)</label>
            <input className={inputCls} type="number" min="1" value={settings.email2DelayMinutes}
              onChange={(e) => update("email2DelayMinutes", parseInt(e.target.value) || 1440)} />
            <p className="text-xs text-[#5a6a84]">Default: 1440 min (24 hours)</p>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Email 3 Delay (minutes)</label>
            <input className={inputCls} type="number" min="1" value={settings.email3DelayMinutes}
              onChange={(e) => update("email3DelayMinutes", parseInt(e.target.value) || 4320)} />
            <p className="text-xs text-[#5a6a84]">Default: 4320 min (72 hours)</p>
          </div>
        </DarkCard>

        <DarkCard title="Discount (Email 3)" description="Auto-generated coupon included with the third email">
          <div className="space-y-1">
            <label className={labelCls}>Discount Percentage (%)</label>
            <input className={inputCls} type="number" min="1" max="50" value={settings.discountPercent}
              onChange={(e) => update("discountPercent", parseInt(e.target.value) || 10)} />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Coupon Expiration (days)</label>
            <input className={inputCls} type="number" min="1" value={settings.expirationDays}
              onChange={(e) => update("expirationDays", parseInt(e.target.value) || 7)} />
          </div>
        </DarkCard>
      </div>
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

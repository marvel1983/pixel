import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Settings {
  id: number;
  enabled: boolean;
  defaultCommissionRate: string;
  minimumPayout: string;
  holdPeriodDays: number;
  autoApprove: boolean;
  cookieDurationDays: number;
  programDescription: string | null;
  termsAndConditions: string | null;
}

const inputCls = "w-full rounded border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const labelCls = "block text-[11.5px] font-medium text-[#8fa0bb] mb-1";

export default function AffiliateSettingsPage() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/admin/affiliate-settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .catch(() => toast({ title: "Error", description: "Failed to load settings", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [token]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/affiliate-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Settings saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#8fa0bb]" /></div>;
  if (!settings) return <p className="text-center text-[#5a6a84] py-12">Failed to load settings</p>;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings({ ...settings, [key]: value });

  return (
    <div className="space-y-4 text-[#dde4f0]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">Affiliate Settings</h1>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded border border-sky-500 bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* General */}
        <DarkCard title="General" description="Enable or disable the affiliate program">
          <div className="flex items-center justify-between py-1">
            <span className="text-[13px] text-[#dde4f0]">Program Enabled</span>
            <Switch checked={settings.enabled} onCheckedChange={(v) => update("enabled", v)} />
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-[13px] text-[#dde4f0]">Auto-Approve Applications</span>
            <Switch checked={settings.autoApprove} onCheckedChange={(v) => update("autoApprove", v)} />
          </div>
        </DarkCard>

        {/* Commission */}
        <DarkCard title="Commission" description="Default rates and payout rules">
          <div>
            <label className={labelCls}>Default Commission Rate (%)</label>
            <input className={inputCls} type="number" min="0" max="100" step="0.01"
              value={settings.defaultCommissionRate}
              onChange={(e) => update("defaultCommissionRate", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Minimum Payout ($)</label>
            <input className={inputCls} type="number" min="0" step="0.01"
              value={settings.minimumPayout}
              onChange={(e) => update("minimumPayout", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Hold Period (days)</label>
            <input className={inputCls} type="number" min="0"
              value={settings.holdPeriodDays}
              onChange={(e) => update("holdPeriodDays", parseInt(e.target.value) || 0)} />
          </div>
        </DarkCard>

        {/* Tracking */}
        <DarkCard title="Tracking" description="Cookie and referral settings">
          <div>
            <label className={labelCls}>Cookie Duration (days)</label>
            <input className={inputCls} type="number" min="1"
              value={settings.cookieDurationDays}
              onChange={(e) => update("cookieDurationDays", parseInt(e.target.value) || 30)} />
          </div>
        </DarkCard>

        {/* Content */}
        <DarkCard title="Content" description="Public-facing program information">
          <div>
            <label className={labelCls}>Program Description</label>
            <textarea className={`${inputCls} resize-none`} rows={3}
              value={settings.programDescription || ""}
              onChange={(e) => update("programDescription", e.target.value || null)} />
          </div>
          <div>
            <label className={labelCls}>Terms & Conditions</label>
            <textarea className={`${inputCls} resize-none`} rows={3}
              value={settings.termsAndConditions || ""}
              onChange={(e) => update("termsAndConditions", e.target.value || null)} />
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

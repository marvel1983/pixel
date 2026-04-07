import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface SPConfig {
  spViewersEnabled: boolean;
  spViewersMin: number;
  spSoldEnabled: boolean;
  spSoldMin: number;
  spToastEnabled: boolean;
  spToastIntervalMin: number;
  spToastIntervalMax: number;
  spToastMaxPerSession: number;
  spStockUrgencyEnabled: boolean;
  spStockLowThreshold: number;
  spStockCriticalThreshold: number;
}

const defaults: SPConfig = {
  spViewersEnabled: true, spViewersMin: 3,
  spSoldEnabled: true, spSoldMin: 5,
  spToastEnabled: true, spToastIntervalMin: 45, spToastIntervalMax: 90, spToastMaxPerSession: 3,
  spStockUrgencyEnabled: true, spStockLowThreshold: 10, spStockCriticalThreshold: 3,
};

export default function SettingsSocialProofTab() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [config, setConfig] = useState<SPConfig>(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/admin/social-proof`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setConfig({ ...defaults, ...d })).catch(() => {});
  }, [token]);

  const set = <K extends keyof SPConfig>(key: K, val: SPConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: val }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/social-proof`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Saved", description: "Social proof settings updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Section title="Live Viewer Count" desc="Show how many people are viewing a product">
        <ToggleRow label="Enable viewer count" checked={config.spViewersEnabled} onChange={(v) => set("spViewersEnabled", v)} />
        <NumRow label="Minimum viewers to show" value={config.spViewersMin} onChange={(v) => set("spViewersMin", v)} />
      </Section>

      <Section title="Sold Counter" desc="Show how many units sold in the last 24 hours">
        <ToggleRow label="Enable sold counter" checked={config.spSoldEnabled} onChange={(v) => set("spSoldEnabled", v)} />
        <NumRow label="Minimum sold to show" value={config.spSoldMin} onChange={(v) => set("spSoldMin", v)} />
      </Section>

      <Section title="Purchase Notification Toast" desc="Show recent purchase popups to visitors">
        <ToggleRow label="Enable purchase toasts" checked={config.spToastEnabled} onChange={(v) => set("spToastEnabled", v)} />
        <NumRow label="Min interval (seconds)" value={config.spToastIntervalMin} onChange={(v) => set("spToastIntervalMin", v)} />
        <NumRow label="Max interval (seconds)" value={config.spToastIntervalMax} onChange={(v) => set("spToastIntervalMax", v)} />
        <NumRow label="Max toasts per session" value={config.spToastMaxPerSession} onChange={(v) => set("spToastMaxPerSession", v)} />
      </Section>

      <Section title="Stock Urgency Badges" desc="Show urgency when stock is running low">
        <ToggleRow label="Enable stock urgency" checked={config.spStockUrgencyEnabled} onChange={(v) => set("spStockUrgencyEnabled", v)} />
        <NumRow label="Low stock threshold" value={config.spStockLowThreshold} onChange={(v) => set("spStockLowThreshold", v)} />
        <NumRow label="Critical stock threshold" value={config.spStockCriticalThreshold} onChange={(v) => set("spStockCriticalThreshold", v)} />
      </Section>

      <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div><h3 className="font-semibold text-sm">{title}</h3><p className="text-xs text-muted-foreground">{desc}</p></div>
      {children}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function NumRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="text-sm">{label}</Label>
      <Input type="number" className="w-24" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2, ShieldAlert } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

const inputCls = "w-24 rounded border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] text-right focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const labelCls = "text-[13px] text-[#dde4f0] flex-1";
const subLabelCls = "text-[11px] text-[#5a6a84]";

interface RiskConfig {
  enabled: boolean;
  holdThreshold: number;
  minOrderHoldAmount: number;
  newAccountHighValueScore: number;
  newAccountHighValueMin: number;
  newAccountBaseScore: number;
  firstOrderScore: number;
  bulkQtyHighScore: number;
  bulkQtyHighMin: number;
  bulkQtyLowScore: number;
  bulkQtyLowMin: number;
  geoMismatchScore: number;
  guestHighValueScore: number;
  guestHighValueMin: number;
  highOrderValueScore: number;
  highOrderValueMin: number;
}

const DEFAULTS: RiskConfig = {
  enabled: true,
  holdThreshold: 60,
  minOrderHoldAmount: 0,
  newAccountHighValueScore: 40,
  newAccountHighValueMin: 50,
  newAccountBaseScore: 15,
  firstOrderScore: 10,
  bulkQtyHighScore: 35,
  bulkQtyHighMin: 5,
  bulkQtyLowScore: 15,
  bulkQtyLowMin: 3,
  geoMismatchScore: 30,
  guestHighValueScore: 20,
  guestHighValueMin: 80,
  highOrderValueScore: 20,
  highOrderValueMin: 200,
};

function NumRow({ label, sub, value, onChange, suffix = "pts" }: {
  label: string; sub?: string; value: number; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#1e2430] last:border-0">
      <div className="flex-1">
        <div className={labelCls}>{label}</div>
        {sub && <div className={subLabelCls}>{sub}</div>}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          className={inputCls}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="text-[11px] text-[#5a6a84] w-6">{suffix}</span>
      </div>
    </div>
  );
}

function DarkCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}>
      <div className="border-b border-[#2a2e3a] px-4 py-3 bg-[#1e2128]">
        <p className="text-[13px] font-bold uppercase tracking-widest text-[#dde4f0]">{title}</p>
        {description && <p className="mt-0.5 text-[11px] text-[#5a6a84]">{description}</p>}
      </div>
      <div className="px-4 py-4 space-y-1">{children}</div>
    </div>
  );
}

export default function SettingsRiskScoringTab() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<RiskConfig>(DEFAULTS);

  useEffect(() => {
    fetch(`${API}/admin/settings/risk-scoring`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => setCfg({ ...DEFAULTS, ...d }))
      .finally(() => setLoading(false));
  }, [token]);

  function set<K extends keyof RiskConfig>(key: K, value: RiskConfig[K]) {
    setCfg((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/settings/risk-scoring`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Risk scoring settings saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <DarkCard title="Risk Scoring" description="Orders that reach the hold threshold are paused for manual review before keys are delivered.">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-[13px] font-medium text-[#dde4f0] flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Enable Order Risk Scoring</p>
            <p className="text-[12px] text-[#5a6a84]">When disabled, all orders are fulfilled immediately</p>
          </div>
          <Switch checked={cfg.enabled} onCheckedChange={(v) => set("enabled", v)} />
        </div>
        <NumRow
          label="Hold Threshold"
          sub="Orders with a total score ≥ this value are put on hold"
          value={cfg.holdThreshold}
          onChange={(v) => set("holdThreshold", v)}
          suffix="pts"
        />
        <NumRow
          label="Minimum Order Hold Amount"
          sub="Any order ≥ this value is auto-held regardless of score. Set to 0 to disable."
          value={cfg.minOrderHoldAmount}
          onChange={(v) => set("minOrderHoldAmount", v)}
          suffix="€"
        />
      </DarkCard>

      <DarkCard title="Signal Scores" description="Points added to the risk score when a signal is detected. Set to 0 to disable a signal.">
        <NumRow label="New account (<24h) + high-value order" sub={`Triggered when order total ≥ €${cfg.newAccountHighValueMin}`} value={cfg.newAccountHighValueScore} onChange={(v) => set("newAccountHighValueScore", v)} />
        <NumRow label="New account (<24h) — base score" sub="Added for any new account, regardless of order value" value={cfg.newAccountBaseScore} onChange={(v) => set("newAccountBaseScore", v)} />
        <NumRow label="First ever order from new account" value={cfg.firstOrderScore} onChange={(v) => set("firstOrderScore", v)} />
        <NumRow label={`Bulk purchase — high (≥ ${cfg.bulkQtyHighMin} units)`} value={cfg.bulkQtyHighScore} onChange={(v) => set("bulkQtyHighScore", v)} />
        <NumRow label={`Bulk purchase — low (≥ ${cfg.bulkQtyLowMin} units)`} value={cfg.bulkQtyLowScore} onChange={(v) => set("bulkQtyLowScore", v)} />
        <NumRow label="IP country ≠ billing country" value={cfg.geoMismatchScore} onChange={(v) => set("geoMismatchScore", v)} />
        <NumRow label="Guest checkout — high-value order" sub={`Triggered when order total ≥ €${cfg.guestHighValueMin}`} value={cfg.guestHighValueScore} onChange={(v) => set("guestHighValueScore", v)} />
        <NumRow label="Very high order total" sub={`Triggered when order total ≥ €${cfg.highOrderValueMin}`} value={cfg.highOrderValueScore} onChange={(v) => set("highOrderValueScore", v)} />
      </DarkCard>

      <DarkCard title="Signal Thresholds" description="Minimum values that trigger each signal.">
        <NumRow label="High-value order minimum (new account)" value={cfg.newAccountHighValueMin} onChange={(v) => set("newAccountHighValueMin", v)} suffix="€" />
        <NumRow label="Bulk high — minimum units" value={cfg.bulkQtyHighMin} onChange={(v) => set("bulkQtyHighMin", v)} suffix="qty" />
        <NumRow label="Bulk low — minimum units" value={cfg.bulkQtyLowMin} onChange={(v) => set("bulkQtyLowMin", v)} suffix="qty" />
        <NumRow label="Guest high-value minimum" value={cfg.guestHighValueMin} onChange={(v) => set("guestHighValueMin", v)} suffix="€" />
        <NumRow label="Very high order minimum" value={cfg.highOrderValueMin} onChange={(v) => set("highOrderValueMin", v)} suffix="€" />
      </DarkCard>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 rounded border border-sky-500 bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Settings
      </button>
    </div>
  );
}

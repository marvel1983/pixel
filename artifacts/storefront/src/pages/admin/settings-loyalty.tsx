import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2, Trophy, Zap, Users } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

const inputCls = "w-full rounded border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const labelCls = "block text-[11.5px] font-medium text-[#8fa0bb] mb-1";

export default function SettingsLoyaltyTab() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    enabled: false,
    pointsPerDollar: 10,
    redemptionRate: "0.01",
    welcomeBonus: 100,
    reviewBonus: 50,
    minRedeemPoints: 500,
    maxRedeemPercent: 50,
    bronzeThreshold: 0,
    silverThreshold: 1000,
    goldThreshold: 5000,
    platinumThreshold: 15000,
    bronzeMultiplier: "1.00",
    silverMultiplier: "1.25",
    goldMultiplier: "1.50",
    platinumMultiplier: "2.00",
    pointsExpiryDays: 0,
    birthdayBonus: 0,
    referralBonus: 0,
  });

  useEffect(() => {
    fetch(`${API}/admin/loyalty/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => setForm((prev) => ({ ...prev, ...d })))
      .finally(() => setLoading(false));
  }, [token]);

  function update(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/loyalty/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Loyalty settings saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/loyalty/events">
          <button className="flex items-center gap-1.5 rounded border border-[#2e3340] bg-[#181c24] px-3 py-1.5 text-[13px] text-[#dde4f0] hover:bg-[#1e2128] transition-colors">
            <Zap className="h-4 w-4 text-yellow-500" /> Double-Points Events
          </button>
        </Link>
        <Link href="/admin/loyalty/bulk">
          <button className="flex items-center gap-1.5 rounded border border-[#2e3340] bg-[#181c24] px-3 py-1.5 text-[13px] text-[#dde4f0] hover:bg-[#1e2128] transition-colors">
            <Users className="h-4 w-4" /> Bulk Operations
          </button>
        </Link>
      </div>
      <DarkCard
        title="Loyalty Program"
        description="Configure points earning, redemption, and tier thresholds."
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#dde4f0] flex items-center gap-2"><Trophy className="h-4 w-4" /> Enable Loyalty Program</p>
            <p className="text-[12px] text-[#5a6a84]">Customers earn points on purchases</p>
          </div>
          <Switch checked={form.enabled} onCheckedChange={(v) => update("enabled", v)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Points per $1 Spent</label>
            <input className={inputCls} type="number" value={form.pointsPerDollar} onChange={(e) => update("pointsPerDollar", parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelCls}>Redemption Rate ($/point)</label>
            <input className={inputCls} value={form.redemptionRate} onChange={(e) => update("redemptionRate", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Welcome Bonus Points</label>
            <input className={inputCls} type="number" value={form.welcomeBonus} onChange={(e) => update("welcomeBonus", parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelCls}>Review Bonus Points</label>
            <input className={inputCls} type="number" value={form.reviewBonus} onChange={(e) => update("reviewBonus", parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelCls}>Min Points to Redeem</label>
            <input className={inputCls} type="number" value={form.minRedeemPoints} onChange={(e) => update("minRedeemPoints", parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelCls}>Max Redeem % of Order</label>
            <input className={inputCls} type="number" value={form.maxRedeemPercent} onChange={(e) => update("maxRedeemPercent", parseInt(e.target.value) || 0)} />
          </div>
        </div>

        <div className="border-t border-[#2a2e3a] pt-4">
          <p className="text-[12px] font-medium text-[#dde4f0] mb-3">Tier Thresholds &amp; Multipliers</p>
          <div className="grid grid-cols-4 gap-3 text-center text-[11px] font-medium text-[#5a6a84] mb-2">
            <span>Bronze</span><span>Silver</span><span>Gold</span><span>Platinum</span>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-2">
            <input className={inputCls} type="number" value={form.bronzeThreshold} onChange={(e) => update("bronzeThreshold", parseInt(e.target.value) || 0)} />
            <input className={inputCls} type="number" value={form.silverThreshold} onChange={(e) => update("silverThreshold", parseInt(e.target.value) || 0)} />
            <input className={inputCls} type="number" value={form.goldThreshold} onChange={(e) => update("goldThreshold", parseInt(e.target.value) || 0)} />
            <input className={inputCls} type="number" value={form.platinumThreshold} onChange={(e) => update("platinumThreshold", parseInt(e.target.value) || 0)} />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <input className={inputCls} value={form.bronzeMultiplier} onChange={(e) => update("bronzeMultiplier", e.target.value)} />
            <input className={inputCls} value={form.silverMultiplier} onChange={(e) => update("silverMultiplier", e.target.value)} />
            <input className={inputCls} value={form.goldMultiplier} onChange={(e) => update("goldMultiplier", e.target.value)} />
            <input className={inputCls} value={form.platinumMultiplier} onChange={(e) => update("platinumMultiplier", e.target.value)} />
          </div>
          <p className="text-[11px] text-[#5a6a84] mt-1">Top row: lifetime points threshold. Bottom row: earning multiplier.</p>
        </div>

        <div>
          <label className={labelCls}>Points Expiry (days, 0 = never)</label>
          <input className={inputCls + " max-w-xs"} type="number" value={form.pointsExpiryDays ?? 0} onChange={(e) => update("pointsExpiryDays", parseInt(e.target.value) || 0)} />
        </div>

        <div className="border-t border-[#2a2e3a] pt-4">
          <p className="text-[12px] font-medium text-[#dde4f0] mb-3">Bonus Events</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Birthday Bonus Points</label>
              <input className={inputCls} type="number" value={form.birthdayBonus ?? 0} onChange={(e) => update("birthdayBonus", parseInt(e.target.value) || 0)} />
              <p className="text-[11px] text-[#5a6a84] mt-1">Points awarded on customer's birthday</p>
            </div>
            <div>
              <label className={labelCls}>Referral Bonus Points</label>
              <input className={inputCls} type="number" value={form.referralBonus ?? 0} onChange={(e) => update("referralBonus", parseInt(e.target.value) || 0)} />
              <p className="text-[11px] text-[#5a6a84] mt-1">Points awarded to referrer when referred customer makes first purchase</p>
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
    <div className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
      <div className="border-b border-[#2a2e3a] px-4 py-3 bg-[#1e2128]">
        <p className="card-title text-[13px] font-bold uppercase tracking-widest">{title}</p>
        {description && <p className="mt-0.5 text-[11px] text-[#5a6a84]">{description}</p>}
      </div>
      <div className="px-4 py-4 space-y-4">{children}</div>
    </div>
  );
}

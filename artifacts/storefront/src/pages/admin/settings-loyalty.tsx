import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2, Trophy } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Loyalty Program</CardTitle>
          <CardDescription>Configure points earning, redemption, and tier thresholds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Enable Loyalty Program</Label>
              <p className="text-sm text-muted-foreground">Customers earn points on purchases</p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => update("enabled", v)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Points per $1 Spent</Label>
              <Input type="number" value={form.pointsPerDollar} onChange={(e) => update("pointsPerDollar", parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Redemption Rate ($/point)</Label>
              <Input value={form.redemptionRate} onChange={(e) => update("redemptionRate", e.target.value)} />
            </div>
            <div>
              <Label>Welcome Bonus Points</Label>
              <Input type="number" value={form.welcomeBonus} onChange={(e) => update("welcomeBonus", parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Review Bonus Points</Label>
              <Input type="number" value={form.reviewBonus} onChange={(e) => update("reviewBonus", parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Min Points to Redeem</Label>
              <Input type="number" value={form.minRedeemPoints} onChange={(e) => update("minRedeemPoints", parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Max Redeem % of Order</Label>
              <Input type="number" value={form.maxRedeemPercent} onChange={(e) => update("maxRedeemPercent", parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Tier Thresholds & Multipliers</p>
            <div className="grid grid-cols-4 gap-3 text-center text-xs font-medium text-muted-foreground mb-2">
              <span>Bronze</span><span>Silver</span><span>Gold</span><span>Platinum</span>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-2">
              <Input type="number" value={form.bronzeThreshold} onChange={(e) => update("bronzeThreshold", parseInt(e.target.value) || 0)} />
              <Input type="number" value={form.silverThreshold} onChange={(e) => update("silverThreshold", parseInt(e.target.value) || 0)} />
              <Input type="number" value={form.goldThreshold} onChange={(e) => update("goldThreshold", parseInt(e.target.value) || 0)} />
              <Input type="number" value={form.platinumThreshold} onChange={(e) => update("platinumThreshold", parseInt(e.target.value) || 0)} />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <Input value={form.bronzeMultiplier} onChange={(e) => update("bronzeMultiplier", e.target.value)} />
              <Input value={form.silverMultiplier} onChange={(e) => update("silverMultiplier", e.target.value)} />
              <Input value={form.goldMultiplier} onChange={(e) => update("goldMultiplier", e.target.value)} />
              <Input value={form.platinumMultiplier} onChange={(e) => update("platinumMultiplier", e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Top row: lifetime points threshold. Bottom row: earning multiplier.</p>
          </div>

          <div>
            <Label>Points Expiry (days, 0 = never)</Label>
            <Input type="number" value={form.pointsExpiryDays ?? 0} onChange={(e) => update("pointsExpiryDays", parseInt(e.target.value) || 0)} className="max-w-xs" />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

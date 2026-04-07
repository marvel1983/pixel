import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!settings) return <p className="text-center text-muted-foreground py-12">Failed to load settings</p>;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings({ ...settings, [key]: value });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Affiliate Settings</h1>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General</CardTitle>
            <CardDescription>Enable or disable the affiliate program</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Program Enabled</Label>
              <Switch checked={settings.enabled} onCheckedChange={(v) => update("enabled", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto-Approve Applications</Label>
              <Switch checked={settings.autoApprove} onCheckedChange={(v) => update("autoApprove", v)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commission</CardTitle>
            <CardDescription>Default rates and payout rules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Default Commission Rate (%)</Label>
              <Input type="number" min="0" max="100" step="0.01"
                value={settings.defaultCommissionRate}
                onChange={(e) => update("defaultCommissionRate", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Minimum Payout ($)</Label>
              <Input type="number" min="0" step="0.01"
                value={settings.minimumPayout}
                onChange={(e) => update("minimumPayout", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Hold Period (days)</Label>
              <Input type="number" min="0"
                value={settings.holdPeriodDays}
                onChange={(e) => update("holdPeriodDays", parseInt(e.target.value) || 0)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tracking</CardTitle>
            <CardDescription>Cookie and referral settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Cookie Duration (days)</Label>
              <Input type="number" min="1"
                value={settings.cookieDurationDays}
                onChange={(e) => update("cookieDurationDays", parseInt(e.target.value) || 30)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content</CardTitle>
            <CardDescription>Public-facing program information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Program Description</Label>
              <Textarea rows={3} value={settings.programDescription || ""}
                onChange={(e) => update("programDescription", e.target.value || null)} />
            </div>
            <div className="space-y-1">
              <Label>Terms & Conditions</Label>
              <Textarea rows={3} value={settings.termsAndConditions || ""}
                onChange={(e) => update("termsAndConditions", e.target.value || null)} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

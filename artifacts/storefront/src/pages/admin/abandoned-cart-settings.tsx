import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

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
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!settings) return <p className="text-center text-muted-foreground py-12">Failed to load settings</p>;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings({ ...settings, [key]: value });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Abandoned Cart Settings</h1>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General</CardTitle>
            <CardDescription>Enable or disable abandoned cart recovery</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Recovery Enabled</Label>
              <Switch checked={settings.enabled} onCheckedChange={(v) => update("enabled", v)} />
            </div>
            <div className="space-y-1">
              <Label>Minimum Cart Value ($)</Label>
              <Input type="number" min="0" step="0.01" value={settings.minCartValue}
                onChange={(e) => update("minCartValue", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Timing</CardTitle>
            <CardDescription>Delay in minutes before each email is sent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Email 1 Delay (minutes)</Label>
              <Input type="number" min="1" value={settings.email1DelayMinutes}
                onChange={(e) => update("email1DelayMinutes", parseInt(e.target.value) || 60)} />
              <p className="text-xs text-muted-foreground">Default: 60 min (1 hour)</p>
            </div>
            <div className="space-y-1">
              <Label>Email 2 Delay (minutes)</Label>
              <Input type="number" min="1" value={settings.email2DelayMinutes}
                onChange={(e) => update("email2DelayMinutes", parseInt(e.target.value) || 1440)} />
              <p className="text-xs text-muted-foreground">Default: 1440 min (24 hours)</p>
            </div>
            <div className="space-y-1">
              <Label>Email 3 Delay (minutes)</Label>
              <Input type="number" min="1" value={settings.email3DelayMinutes}
                onChange={(e) => update("email3DelayMinutes", parseInt(e.target.value) || 4320)} />
              <p className="text-xs text-muted-foreground">Default: 4320 min (72 hours)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Discount (Email 3)</CardTitle>
            <CardDescription>Auto-generated coupon included with the third email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Discount Percentage (%)</Label>
              <Input type="number" min="1" max="50" value={settings.discountPercent}
                onChange={(e) => update("discountPercent", parseInt(e.target.value) || 10)} />
            </div>
            <div className="space-y-1">
              <Label>Coupon Expiration (days)</Label>
              <Input type="number" min="1" value={settings.expirationDays}
                onChange={(e) => update("expirationDays", parseInt(e.target.value) || 7)} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

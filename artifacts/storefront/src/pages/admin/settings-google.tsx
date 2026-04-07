import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2, Eye, EyeOff, Shield, ExternalLink } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Google OAuth Settings
          </CardTitle>
          <CardDescription>
            Allow users to sign in with their Google account. You need to create OAuth credentials in the{" "}
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
              Google Cloud Console <ExternalLink className="h-3 w-3" />
            </a>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Enable Google Sign-In</Label>
              <p className="text-sm text-muted-foreground">Show "Continue with Google" on login and register pages</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxx.apps.googleusercontent.com"
              />
            </div>
            <div>
              <Label htmlFor="clientSecret">
                Client Secret {hasSecret && !clientSecret && <span className="text-xs text-muted-foreground ml-1">(saved, enter new value to change)</span>}
              </Label>
              <div className="relative">
                <Input
                  id="clientSecret"
                  type={showSecret ? "text" : "password"}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={hasSecret ? "Enter new secret to update" : "Enter client secret"}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowSecret(!showSecret)}>
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">
              Set the authorized redirect URI in Google Console to:
            </p>
            <code className="text-xs bg-muted px-2 py-1 rounded block overflow-x-auto">
              {window.location.origin}/api/auth/google/callback
            </code>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Settings
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing || !hasSecret}>
              {testing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Test Connection
            </Button>
          </div>
          {testResult && (
            <p className={`text-sm mt-2 ${testResult.success ? "text-green-600" : "text-red-600"}`}>
              {testResult.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

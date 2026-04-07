import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2, Link2, Unlink, Lock, CheckCircle2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function ConnectedAccountsTab() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);
  const [unlinking, setUnlinking] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [settingPw, setSettingPw] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/auth/google/status`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      }).then((r) => r.json()),
      fetch(`${API}/auth/google/enabled`).then((r) => r.json()),
    ]).then(([status, config]) => {
      setGoogleLinked(status.googleLinked);
      setHasPassword(status.hasPassword);
      setGoogleEnabled(config.enabled);
      setLoading(false);
    }).catch(() => setLoading(false));

    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "linked") {
      toast({ title: "Google account linked successfully" });
    }
    const err = params.get("error");
    if (err) {
      toast({ title: "Failed to link", description: err, variant: "destructive" });
    }
  }, [token, toast]);

  async function handleUnlink() {
    setUnlinking(true);
    try {
      const res = await fetch(`${API}/auth/google/unlink`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGoogleLinked(false);
      toast({ title: "Google account unlinked" });
    } catch (err) {
      toast({ title: "Failed to unlink", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setUnlinking(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setSettingPw(true);
    try {
      const res = await fetch(`${API}/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) throw new Error("Failed to set password");
      setHasPassword(true);
      setNewPassword("");
      toast({ title: "Password set successfully" });
    } catch {
      toast({ title: "Failed to set password", variant: "destructive" });
    } finally {
      setSettingPw(false);
    }
  }

  function handleLink() {
    window.location.href = `${API}/auth/google?mode=link`;
  }

  if (loading) {
    return <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;
  }

  return (
    <div className="space-y-4 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <GoogleIcon />
              <div>
                <p className="font-medium">Google</p>
                <p className="text-sm text-muted-foreground">
                  {googleLinked ? (
                    <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" /> Connected</span>
                  ) : "Not connected"}
                </p>
              </div>
            </div>
            {googleLinked ? (
              <Button variant="outline" size="sm" onClick={handleUnlink} disabled={unlinking || !hasPassword}>
                {unlinking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Unlink className="h-4 w-4 mr-1" />}
                Unlink
              </Button>
            ) : googleEnabled ? (
              <Button variant="outline" size="sm" onClick={handleLink}>
                <Link2 className="h-4 w-4 mr-1" /> Link
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Disabled by admin</span>
            )}
          </div>

          {googleLinked && !hasPassword && (
            <div className="p-4 border rounded-lg bg-amber-50 border-amber-200">
              <p className="text-sm font-medium text-amber-800 flex items-center gap-1 mb-2">
                <Lock className="h-4 w-4" /> Set a password to enable email login
              </p>
              <p className="text-xs text-amber-700 mb-3">You signed up with Google. Set a password if you want to log in with email too, or before unlinking Google.</p>
              <form onSubmit={handleSetPassword} className="flex gap-2">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  minLength={8}
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={settingPw}>
                  {settingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set Password"}
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

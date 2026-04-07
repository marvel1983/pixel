import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, DollarSign, Webhook, FileText, KeyRound, AlertTriangle } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface BalanceData { configured: boolean; balance?: number; currency?: string; error?: string }
interface StatusData { configured: boolean; isActive?: boolean; lastSync?: string; webhooks?: { total: number; active: number }; claims?: { total: number; pending: number } }
interface KeyData { lastRotated: string | null; daysSinceRotation: number | null; needsRotation?: boolean }

export default function MetenziBalancePage() {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [keyInfo, setKeyInfo] = useState<KeyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/admin/metenzi/balance`, { headers }).then((r) => r.json()),
      fetch(`${API}/admin/metenzi/status`, { headers }).then((r) => r.json()),
      fetch(`${API}/admin/metenzi/key-rotation`, { headers }).then((r) => r.json()),
    ]).then(([b, s, k]) => {
      setBalance(b); setStatus(s); setKeyInfo(k); setLastRefresh(new Date());
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const iv = setInterval(fetchAll, 60000); return () => clearInterval(iv); }, [fetchAll]);

  if (loading && !balance) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>;
  if (balance && !balance.configured) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Metenzi Balance</h1>
      <Card><CardContent className="py-12 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
        <p className="text-lg font-medium">Metenzi API not configured</p>
        <p className="text-sm text-muted-foreground mt-2">Set up your API keys in Settings → API Keys to enable this page.</p>
      </CardContent></Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Metenzi Balance</h1>
          <p className="text-sm text-muted-foreground">Last refreshed: {lastRefresh.toLocaleTimeString()} (auto-refresh every 60s)</p>
        </div>
        <Button variant="outline" onClick={fetchAll} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Account Balance</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>
            {balance?.error ? <p className="text-sm text-red-500">{balance.error}</p>
              : <p className="text-2xl font-bold">${(balance?.balance ?? 0).toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{balance?.currency}</span></p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Webhooks</CardTitle><Webhook className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{status?.webhooks?.active ?? 0}<span className="text-sm font-normal text-muted-foreground"> / {status?.webhooks?.total ?? 0}</span></p>
            <p className="text-xs text-muted-foreground">active webhooks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Recent Claims</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{status?.claims?.total ?? 0}</p>
            {(status?.claims?.pending ?? 0) > 0 && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 mt-1">{status?.claims?.pending} pending</Badge>}
            {(status?.claims?.pending ?? 0) === 0 && <p className="text-xs text-muted-foreground">no pending claims</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">API Key Status</CardTitle><KeyRound className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>
            {keyInfo?.lastRotated ? (<>
              <p className="text-2xl font-bold">{keyInfo.daysSinceRotation}d</p>
              <p className="text-xs text-muted-foreground">since last rotation</p>
              {keyInfo.needsRotation && <Badge variant="destructive" className="mt-1">Rotation recommended</Badge>}
            </>) : <p className="text-sm text-muted-foreground">No key data</p>}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Account Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Connection</span><Badge variant={status?.isActive ? "default" : "destructive"}>{status?.isActive ? "Active" : "Inactive"}</Badge></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Last Sync</span><span className="text-sm">{status?.lastSync ? new Date(status.lastSync).toLocaleString() : "Never"}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Key Rotation Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Last Rotated</span><span className="text-sm">{keyInfo?.lastRotated ? new Date(keyInfo.lastRotated).toLocaleDateString() : "Unknown"}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Days Since</span><span className="text-sm">{keyInfo?.daysSinceRotation ?? "—"}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Status</span>
              {keyInfo?.needsRotation ? <Badge variant="destructive">Rotation needed</Badge> : <Badge className="bg-green-100 text-green-800" variant="secondary">OK</Badge>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

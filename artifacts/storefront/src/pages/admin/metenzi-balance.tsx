import { useState, useEffect, useCallback } from "react";
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

  if (loading && !balance) return <div className="flex items-center justify-center py-12 text-[#5a6a84]">Loading...</div>;
  if (balance && !balance.configured) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Metenzi Balance</h1>
      <div className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
        <div className="py-12 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <p className="text-lg font-medium text-[#dde4f0]">Metenzi API not configured</p>
          <p className="text-sm text-[#5a6a84] mt-2">Set up your API keys in Settings → API Keys to enable this page.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Metenzi Balance</h1>
          <p className="text-sm text-[#5a6a84]">Last refreshed: {lastRefresh.toLocaleTimeString()} (auto-refresh every 60s)</p>
        </div>
        <Button variant="outline" onClick={fetchAll} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: DollarSign,
            title: "Account Balance",
            content: balance?.error
              ? <p className="text-sm text-red-400">{balance.error}</p>
              : <p className="text-2xl font-bold text-[#dde4f0]">${(balance?.balance ?? 0).toFixed(2)} <span className="text-sm font-normal text-[#5a6a84]">{balance?.currency}</span></p>
          },
          {
            icon: Webhook,
            title: "Webhooks",
            content: <>
              <p className="text-2xl font-bold text-[#dde4f0]">{status?.webhooks?.active ?? 0}<span className="text-sm font-normal text-[#5a6a84]"> / {status?.webhooks?.total ?? 0}</span></p>
              <p className="text-xs text-[#5a6a84]">active webhooks</p>
            </>
          },
          {
            icon: FileText,
            title: "Recent Claims",
            content: <>
              <p className="text-2xl font-bold text-[#dde4f0]">{status?.claims?.total ?? 0}</p>
              {(status?.claims?.pending ?? 0) > 0 && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 mt-1">{status?.claims?.pending} pending</Badge>}
              {(status?.claims?.pending ?? 0) === 0 && <p className="text-xs text-[#5a6a84]">no pending claims</p>}
            </>
          },
          {
            icon: KeyRound,
            title: "API Key Status",
            content: keyInfo?.lastRotated ? <>
              <p className="text-2xl font-bold text-[#dde4f0]">{keyInfo.daysSinceRotation}d</p>
              <p className="text-xs text-[#5a6a84]">since last rotation</p>
              {keyInfo.needsRotation && <Badge variant="destructive" className="mt-1">Rotation recommended</Badge>}
            </> : <p className="text-sm text-[#5a6a84]">No key data</p>
          },
        ].map((card) => (
          <div key={card.title} className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
            <div className="border-b border-[#2a2e3a] px-4 py-3 bg-[#1e2128] flex items-center justify-between">
              <p className="text-[13px] font-bold uppercase tracking-widest">{card.title}</p>
              <card.icon className="h-4 w-4 text-[#5a6a84]" />
            </div>
            <div className="px-4 py-4">{card.content}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <DarkCard title="Account Status">
          <div className="flex items-center justify-between"><span className="text-sm text-[#5a6a84]">Connection</span><Badge variant={status?.isActive ? "default" : "destructive"}>{status?.isActive ? "Active" : "Inactive"}</Badge></div>
          <div className="flex items-center justify-between"><span className="text-sm text-[#5a6a84]">Last Sync</span><span className="text-sm text-[#dde4f0]">{status?.lastSync ? new Date(status.lastSync).toLocaleString() : "Never"}</span></div>
        </DarkCard>
        <DarkCard title="Key Rotation Info">
          <div className="flex items-center justify-between"><span className="text-sm text-[#5a6a84]">Last Rotated</span><span className="text-sm text-[#dde4f0]">{keyInfo?.lastRotated ? new Date(keyInfo.lastRotated).toLocaleDateString() : "Unknown"}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-[#5a6a84]">Days Since</span><span className="text-sm text-[#dde4f0]">{keyInfo?.daysSinceRotation ?? "—"}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-[#5a6a84]">Status</span>
            {keyInfo?.needsRotation ? <Badge variant="destructive">Rotation needed</Badge> : <Badge className="bg-green-100 text-green-800" variant="secondary">OK</Badge>}
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

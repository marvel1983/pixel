import { useState, useEffect, type ComponentType } from "react";
import { Loader2, Shield, BarChart3, Eye, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface ConsentStats {
  total: number;
  analytics: number;
  marketing: number;
  preferences: number;
}

interface ConsentLogEntry {
  id: number;
  ipHash: string | null;
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  consentAction: string;
  createdAt: string;
}

type ConfigFields = Record<string, string>;

const CONFIG_FIELDS = [
  { key: "bannerTitle", label: "Banner Title" },
  { key: "bannerText", label: "Banner Text" },
  { key: "privacyPolicyUrl", label: "Privacy Policy URL" },
  { key: "acceptAllLabel", label: "Accept All Button" },
  { key: "rejectAllLabel", label: "Reject All Button" },
  { key: "customizeLabel", label: "Customize Button" },
  { key: "savePrefsLabel", label: "Save Preferences Button" },
  { key: "necessaryLabel", label: "Necessary Category Label" },
  { key: "necessaryDesc", label: "Necessary Description" },
  { key: "analyticsLabel", label: "Analytics Category Label" },
  { key: "analyticsDesc", label: "Analytics Description" },
  { key: "marketingLabel", label: "Marketing Category Label" },
  { key: "marketingDesc", label: "Marketing Description" },
  { key: "preferencesLabel", label: "Preferences Category Label" },
  { key: "preferencesDesc", label: "Preferences Description" },
];

export default function SettingsConsentTab() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<ConsentStats | null>(null);
  const [logs, setLogs] = useState<ConsentLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ConfigFields>({});
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    fetch(`${API}/admin/consent/stats`, { headers, credentials: "include" })
      .then((r) => r.json()).then(setStats).catch(() => {});
    fetch(`${API}/admin/consent/config`, { headers, credentials: "include" })
      .then((r) => r.json()).then((d) => { setConfig(d.config || {}); setConfigLoading(false); })
      .catch(() => setConfigLoading(false));
    loadLogs();
  }, []);

  useEffect(() => { loadLogs(); }, [page]);

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/consent/logs?page=${page}`, { headers, credentials: "include" });
      if (res.ok) { const data = await res.json(); setLogs(data.logs); setTotalPages(data.totalPages); }
    } catch {} finally { setLoading(false); }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/consent/config`, { method: "PUT", headers, credentials: "include", body: JSON.stringify(config) });
      if (res.ok) { const d = await res.json(); setConfig(d.config || config); }
    } catch {} finally { setSaving(false); }
  }

  const pct = (n: number) => stats && stats.total > 0 ? Math.round((n / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Cookie Consent & GDPR</h2>
        <p className="text-sm text-muted-foreground">
          Configure banner text, manage consent categories, and view the audit log.
        </p>
      </div>

      {stats && (
        <div className="grid sm:grid-cols-4 gap-4">
          <StatCard icon={Shield} label="Total Consents" value={stats.total} color="blue" />
          <StatCard icon={BarChart3} label="Analytics Opt-in" value={`${pct(stats.analytics)}%`} sub={`${stats.analytics} users`} color="green" />
          <StatCard icon={Eye} label="Marketing Opt-in" value={`${pct(stats.marketing)}%`} sub={`${stats.marketing} users`} color="orange" />
          <StatCard icon={Shield} label="Preferences Opt-in" value={`${pct(stats.preferences)}%`} sub={`${stats.preferences} users`} color="purple" />
        </div>
      )}

      <ConfigEditor config={config} setConfig={setConfig} loading={configLoading} saving={saving} onSave={saveConfig} />

      <div>
        <h3 className="font-semibold text-sm mb-3">Consent Audit Log</h3>
        <AuditTable logs={logs} loading={loading} />
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-3">
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => (
              <Button key={i} variant={page === i + 1 ? "default" : "outline"} size="sm" onClick={() => setPage(i + 1)}>{i + 1}</Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigEditor({ config, setConfig, loading, saving, onSave }: {
  config: ConfigFields; setConfig: (c: ConfigFields) => void; loading: boolean; saving: boolean; onSave: () => void;
}) {
  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Banner & Category Configuration</h3>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {CONFIG_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
            {f.key.endsWith("Desc") || f.key === "bannerText" ? (
              <textarea className="w-full border rounded px-2 py-1.5 text-sm min-h-[60px] resize-y"
                value={config[f.key] ?? ""} onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })} />
            ) : (
              <Input className="text-sm h-8" value={config[f.key] ?? ""}
                onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditTable({ logs, loading }: { logs: ConsentLogEntry[]; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (logs.length === 0) return <p className="text-center text-muted-foreground py-8 text-sm">No consent logs yet.</p>;
  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Action</th>
            <th className="px-3 py-2 font-medium hidden sm:table-cell">IP (hashed)</th>
            <th className="px-3 py-2 font-medium">Analytics</th>
            <th className="px-3 py-2 font-medium">Marketing</th>
            <th className="px-3 py-2 font-medium hidden md:table-cell">Preferences</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-muted/30">
              <td className="px-3 py-2">{new Date(log.createdAt).toLocaleString()}</td>
              <td className="px-3 py-2"><Badge variant="outline" className="text-xs">{log.consentAction}</Badge></td>
              <td className="px-3 py-2 hidden sm:table-cell font-mono">{log.ipHash?.slice(0, 12)}...</td>
              <td className="px-3 py-2">{log.analytics ? "✓" : "✗"}</td>
              <td className="px-3 py-2">{log.marketing ? "✓" : "✗"}</td>
              <td className="px-3 py-2 hidden md:table-cell">{log.preferences ? "✓" : "✗"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: ComponentType<{ className?: string }>; label: string; value: string | number; sub?: string; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600", purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded ${colorMap[color] || ""}`}><Icon className="h-4 w-4" /></div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

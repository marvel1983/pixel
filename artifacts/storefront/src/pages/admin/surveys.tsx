import { useState, useEffect } from "react";
import { Star, MessageSquare, TrendingUp, Settings, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface SurveyStats { total: number; avg: number; nps: number; distribution: number[] }
interface SurveyResponse { id: number; orderId: number; rating: number; comment: string | null; submittedAt: string }
interface SurveySettingsData { enabled: boolean; delayDays: number; emailSubject: string; emailBody?: string | null }

export default function AdminSurveysPage() {
  const token = useAuthStore.getState().token;
  const { toast } = useToast();
  const [tab, setTab] = useState<"overview" | "responses" | "settings">("overview");
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [settings, setSettings] = useState<SurveySettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    Promise.all([
      fetch(`${API}/admin/surveys/stats`, { headers }).then((r) => r.json()),
      fetch(`${API}/admin/surveys/responses`, { headers }).then((r) => r.json()),
      fetch(`${API}/admin/surveys/settings`, { headers }).then((r) => r.json()),
    ]).then(([s, r, st]) => {
      setStats(s);
      setResponses(r.responses ?? []);
      setSettings(st);
    }).catch(() => toast({ title: "Failed to load survey data", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading surveys...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Customer Surveys</h1><p className="text-sm text-muted-foreground">Post-purchase NPS & satisfaction</p></div>
        <div className="flex gap-2">
          {(["overview", "responses", "settings"] as const).map((t) => (
            <Button key={t} variant={tab === t ? "default" : "outline"} size="sm" onClick={() => setTab(t)} className="capitalize">{t}</Button>
          ))}
        </div>
      </div>
      {tab === "overview" && stats && <OverviewTab stats={stats} />}
      {tab === "responses" && <ResponsesTab responses={responses} />}
      {tab === "settings" && settings && <SettingsTab settings={settings} setSettings={setSettings} token={token} toast={toast} />}
    </div>
  );
}

function OverviewTab({ stats }: { stats: SurveyStats }) {
  const maxDist = Math.max(...stats.distribution, 1);
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="border rounded-lg bg-white p-5">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-blue-600" /><span className="text-xs text-muted-foreground font-medium">NPS Score</span></div>
          <p className={`text-3xl font-bold ${stats.nps >= 50 ? "text-green-600" : stats.nps >= 0 ? "text-amber-600" : "text-red-600"}`}>{stats.nps}</p>
          <p className="text-[10px] text-muted-foreground mt-1">4-5★ promoters · 3★ passive · 1-2★ detractors</p>
        </div>
        <div className="border rounded-lg bg-white p-5">
          <div className="flex items-center gap-2 mb-2"><Star className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground font-medium">Average Rating</span></div>
          <p className="text-3xl font-bold">{stats.avg}<span className="text-lg text-muted-foreground">/5</span></p>
        </div>
        <div className="border rounded-lg bg-white p-5">
          <div className="flex items-center gap-2 mb-2"><MessageSquare className="h-4 w-4 text-green-600" /><span className="text-xs text-muted-foreground font-medium">Total Responses</span></div>
          <p className="text-3xl font-bold">{stats.total}</p>
        </div>
      </div>
      <div className="border rounded-lg bg-white p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Rating Distribution</h3>
        <div className="space-y-3">
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="flex items-center gap-3">
              <span className="text-sm font-medium w-16 flex items-center gap-1">{n} <Star className="h-3 w-3 fill-amber-400 text-amber-400" /></span>
              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${n >= 4 ? "bg-green-500" : n === 3 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${(stats.distribution[n - 1] / maxDist) * 100}%` }} />
              </div>
              <span className="text-sm text-muted-foreground w-8 text-right">{stats.distribution[n - 1]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResponsesTab({ responses }: { responses: SurveyResponse[] }) {
  if (responses.length === 0) return (
    <div className="border rounded-lg bg-white p-12 text-center"><MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No survey responses yet</p></div>
  );
  return (
    <div className="space-y-3">
      {responses.map((r) => (
        <div key={r.id} className="border rounded-lg bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />)}</div>
              <span className="text-sm font-medium">{r.rating}/5</span>
            </div>
            <div className="text-xs text-muted-foreground">Order #{r.orderId} · {new Date(r.submittedAt).toLocaleDateString()}</div>
          </div>
          {r.comment && <p className="text-sm text-muted-foreground bg-muted/30 rounded p-2 mt-2">{r.comment}</p>}
        </div>
      ))}
    </div>
  );
}

interface SettingsProps { settings: SurveySettingsData; setSettings: (s: SurveySettingsData) => void; token: string | null; toast: ReturnType<typeof useToast>["toast"] }

function SettingsTab({ settings, setSettings, token, toast }: SettingsProps) {
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/surveys/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Survey settings saved" });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="border rounded-lg bg-white p-6 max-w-lg space-y-5">
      <h3 className="font-semibold flex items-center gap-2"><Settings className="h-4 w-4" /> Survey Settings</h3>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} className="h-4 w-4 rounded" />
        <span className="text-sm font-medium">Enable post-purchase surveys</span>
      </label>
      <div>
        <label className="text-sm font-medium mb-1 block">Delay after order completion (days)</label>
        <input type="number" min={1} max={30} value={settings.delayDays} onChange={(e) => setSettings({ ...settings, delayDays: parseInt(e.target.value, 10) || 3 })}
          className="border rounded-md px-3 py-2 text-sm w-24 bg-background" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Email Subject</label>
        <input type="text" value={settings.emailSubject} onChange={(e) => setSettings({ ...settings, emailSubject: e.target.value })}
          className="w-full border rounded-md px-3 py-2 text-sm bg-background" maxLength={200} />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Custom Email Body (optional HTML)</label>
        <textarea value={settings.emailBody ?? ""} onChange={(e) => setSettings({ ...settings, emailBody: e.target.value })}
          className="w-full border rounded-md px-3 py-2 text-sm bg-background min-h-[100px] resize-y font-mono" placeholder="Leave blank for default template" />
      </div>
      <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
    </div>
  );
}

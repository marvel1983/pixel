import { useState, useEffect, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Plus, Trash2, Loader2, Star, Database } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "/api";

const inputCls = "w-full rounded border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";

interface Locale { id: number; code: string; name: string; flag: string; enabled: boolean; isDefault: boolean }
interface Override { id: number; locale: string; key: string; value: string }

export default function I18nSettingsPage() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [locales, setLocales] = useState<Locale[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLocale, setFilterLocale] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newLocale, setNewLocale] = useState("en");
  const [saving, setSaving] = useState(false);

  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    const [lr, or] = await Promise.all([
      fetch(`${API}/admin/locales`, { headers }).then((r) => r.json()),
      fetch(`${API}/admin/locales/overrides${filterLocale ? `?locale=${filterLocale}` : ""}`, { headers }).then((r) => r.json()),
    ]);
    setLocales(lr.locales || []);
    setOverrides(or.overrides || []);
    setLoading(false);
  }, [token, filterLocale]);

  useEffect(() => { load(); }, [load]);

  async function seed() {
    await fetch(`${API}/admin/locales/seed`, { method: "POST", headers });
    toast({ title: "Locales seeded" });
    load();
  }

  async function toggleLocale(code: string, enabled: boolean) {
    const res = await fetch(`${API}/admin/locales/${code}`, {
      method: "PUT", headers, body: JSON.stringify({ enabled }),
    });
    if (!res.ok) { const d = await res.json(); toast({ title: d.error, variant: "destructive" }); return; }
    load();
  }

  async function setDefault(code: string) {
    await fetch(`${API}/admin/locales/${code}`, {
      method: "PUT", headers, body: JSON.stringify({ isDefault: true }),
    });
    toast({ title: `${code} set as default` });
    load();
  }

  async function addOverride() {
    if (!newKey || !newValue) return;
    setSaving(true);
    await fetch(`${API}/admin/locales/overrides`, {
      method: "POST", headers, body: JSON.stringify({ locale: newLocale, key: newKey, value: newValue }),
    });
    setNewKey(""); setNewValue("");
    setSaving(false);
    load();
  }

  async function deleteOverride(id: number) {
    await fetch(`${API}/admin/locales/overrides/${id}`, { method: "DELETE", headers });
    load();
  }

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Language Settings</h1>
          <p className="text-sm text-[#5a6a84]">Manage supported languages and translation overrides</p>
        </div>
        {locales.length === 0 && (
          <button
            onClick={seed}
            className="flex items-center gap-2 rounded border border-sky-500 bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
          >
            <Database className="h-4 w-4" /> Seed Defaults
          </button>
        )}
      </div>

      <DarkCard title="Supported Languages">
        <div className="divide-y divide-[#2a2e3a]">
          {locales.map((loc) => (
            <div key={loc.code} className="flex items-center gap-4 py-3">
              <span className="text-2xl">{loc.flag}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#dde4f0]">{loc.name}</span>
                  <Badge variant="outline" className="text-xs">{loc.code}</Badge>
                  {loc.isDefault && <Badge className="bg-blue-100 text-blue-800 text-xs">Default</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!loc.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => setDefault(loc.code)}>
                    <Star className="h-3.5 w-3.5 mr-1" /> Set Default
                  </Button>
                )}
                <Switch checked={loc.enabled} onCheckedChange={(v) => toggleLocale(loc.code, v)} disabled={loc.isDefault} />
              </div>
            </div>
          ))}
        </div>
      </DarkCard>

      <DarkCard title="Translation Overrides">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-[#5a6a84]">Filter by language</span>
          <select
            className="rounded border border-[#2e3340] bg-[#0f1117] px-2 py-1 text-[12px] text-[#dde4f0] focus:outline-none"
            value={filterLocale}
            onChange={(e) => setFilterLocale(e.target.value)}
          >
            <option value="">All languages</option>
            {locales.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded border border-[#2e3340] bg-[#0f1117] px-2 py-1 text-[12px] text-[#dde4f0] focus:outline-none"
            value={newLocale}
            onChange={(e) => setNewLocale(e.target.value)}
          >
            {locales.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.code}</option>)}
          </select>
          <input className={inputCls} placeholder="Translation key (e.g. nav.bestSellers)" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <input className={inputCls} placeholder="Override value" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          <button
            onClick={addOverride}
            disabled={saving || !newKey || !newValue}
            className="flex items-center gap-1 rounded border border-sky-500 bg-sky-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {overrides.length === 0 ? (
          <p className="text-sm text-[#5a6a84] text-center py-4">No translation overrides yet. Add one above to customize any translation string.</p>
        ) : (
          <div className="border border-[#2e3340] rounded-lg divide-y divide-[#1f2840] max-h-96 overflow-y-auto">
            {overrides.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-3 py-2 text-sm bg-[#0f1117] hover:bg-[#111825]">
                <Badge variant="outline" className="shrink-0">{o.locale}</Badge>
                <span className="text-[#5a6a84] font-mono text-xs flex-1 truncate">{o.key}</span>
                <span className="flex-1 truncate text-[#dde4f0]">{o.value}</span>
                <Button variant="ghost" size="sm" onClick={() => deleteOverride(o.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
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

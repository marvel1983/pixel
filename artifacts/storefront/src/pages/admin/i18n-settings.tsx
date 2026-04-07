import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Plus, Trash2, Loader2, Star, Database } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "/api";

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
          <p className="text-sm text-muted-foreground">Manage supported languages and translation overrides</p>
        </div>
        {locales.length === 0 && <Button onClick={seed}><Database className="h-4 w-4 mr-1" /> Seed Defaults</Button>}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Supported Languages</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y">
            {locales.map((loc) => (
              <div key={loc.code} className="flex items-center gap-4 py-3">
                <span className="text-2xl">{loc.flag}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{loc.name}</span>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Translation Overrides</CardTitle>
            <select className="text-sm border rounded px-2 py-1" value={filterLocale} onChange={(e) => setFilterLocale(e.target.value)}>
              <option value="">All languages</option>
              {locales.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={newLocale} onChange={(e) => setNewLocale(e.target.value)}>
              {locales.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.code}</option>)}
            </select>
            <Input placeholder="Translation key (e.g. nav.bestSellers)" value={newKey} onChange={(e) => setNewKey(e.target.value)} className="flex-1" />
            <Input placeholder="Override value" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="flex-1" />
            <Button onClick={addOverride} disabled={saving || !newKey || !newValue}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          {overrides.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No translation overrides yet. Add one above to customize any translation string.</p>
          ) : (
            <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
              {overrides.map((o) => (
                <div key={o.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Badge variant="outline" className="shrink-0">{o.locale}</Badge>
                  <span className="text-muted-foreground font-mono text-xs flex-1 truncate">{o.key}</span>
                  <span className="flex-1 truncate">{o.value}</span>
                  <Button variant="ghost" size="sm" onClick={() => deleteOverride(o.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

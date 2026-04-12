import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Plus, Percent, Globe, Building2, Receipt } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

const inputCls = "w-full rounded border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const labelCls = "block text-[11.5px] font-medium text-[#8fa0bb] mb-1";

interface TaxConfig {
  id: number; enabled: boolean; priceDisplay: string; taxLabel: string;
  defaultRate: string; merchantVatNumber: string | null; b2bExemptionEnabled: boolean;
}
interface TaxRate {
  id: number; countryCode: string; countryName: string; rate: string; isEnabled: boolean;
}

export default function TaxSettingsPage() {
  const token = useAuthStore((s) => s.token);
  const [config, setConfig] = useState<TaxConfig | null>(null);
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newCountryCode, setNewCountryCode] = useState("");
  const [newCountryName, setNewCountryName] = useState("");
  const [newRate, setNewRate] = useState("");
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  const [editRate, setEditRate] = useState("");
  const [search, setSearch] = useState("");
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchAll = useCallback(() => {
    fetch(`${API}/admin/tax-settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => { setConfig(d.settings); setRates(d.rates); }).catch(() => {});
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveConfig = async (updates: Partial<TaxConfig>) => {
    setSaving(true);
    const res = await fetch(`${API}/admin/tax-settings`, { method: "PUT", headers, body: JSON.stringify(updates) });
    const d = await res.json();
    setConfig(d.settings);
    setSaving(false);
  };

  const addRate = async () => {
    if (!newCountryCode || !newCountryName || !newRate) return;
    const res = await fetch(`${API}/admin/tax-rates`, { method: "POST", headers, body: JSON.stringify({ countryCode: newCountryCode, countryName: newCountryName, rate: newRate }) });
    if (res.ok) { setAddOpen(false); setNewCountryCode(""); setNewCountryName(""); setNewRate(""); fetchAll(); }
  };

  const updateRate = async (id: number, data: Record<string, unknown>) => {
    await fetch(`${API}/admin/tax-rates/${id}`, { method: "PUT", headers, body: JSON.stringify(data) });
    fetchAll();
  };

  const deleteRate = async (id: number) => {
    if (!confirm("Delete this tax rate?")) return;
    await fetch(`${API}/admin/tax-rates/${id}`, { method: "DELETE", headers });
    fetchAll();
  };

  const filteredRates = rates.filter((r) => r.countryName.toLowerCase().includes(search.toLowerCase()) || r.countryCode.toLowerCase().includes(search.toLowerCase()));

  if (!config) return <div className="p-8 text-center text-[#5a6a84]">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tax / VAT Settings</h1>
        <p className="text-sm text-[#5a6a84]">Configure tax rates and VAT settings for checkout</p>
      </div>
      <DarkCard title="General Settings">
        <div className="flex items-center justify-between">
          <div>
            <label className={labelCls + " mb-0 font-semibold text-[#dde4f0] text-[13px]"}>
              <Receipt className="h-4 w-4 inline mr-1" />Enable Tax Calculation
            </label>
            <p className="text-xs text-[#5a6a84]">Apply tax to orders based on customer location</p>
          </div>
          <Switch checked={config.enabled} onCheckedChange={(v) => saveConfig({ enabled: v })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Price Display</label>
            <Select value={config.priceDisplay} onValueChange={(v) => saveConfig({ priceDisplay: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="exclusive">Exclusive of tax</SelectItem>
                <SelectItem value="inclusive">Inclusive of tax</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={labelCls}>Tax Label</label>
            <input className={inputCls} value={config.taxLabel} onChange={(e) => setConfig({ ...config, taxLabel: e.target.value })} onBlur={() => saveConfig({ taxLabel: config.taxLabel })} />
          </div>
          <div>
            <label className={labelCls}>Default Tax Rate (%)</label>
            <input className={inputCls} value={config.defaultRate} onChange={(e) => setConfig({ ...config, defaultRate: e.target.value })} onBlur={() => saveConfig({ defaultRate: config.defaultRate })} type="number" step="0.01" />
          </div>
        </div>
      </DarkCard>
      <DarkCard title="B2B / VAT Exemption">
        <div className="flex items-center justify-between">
          <div>
            <label className={labelCls + " mb-0 font-semibold text-[#dde4f0] text-[13px]"}>
              <Building2 className="h-4 w-4 inline mr-1" />B2B Tax Exemption
            </label>
            <p className="text-xs text-[#5a6a84]">Allow business customers to enter a VAT number for tax exemption</p>
          </div>
          <Switch checked={config.b2bExemptionEnabled} onCheckedChange={(v) => saveConfig({ b2bExemptionEnabled: v })} />
        </div>
        <div>
          <label className={labelCls}>Merchant VAT Number</label>
          <input className={inputCls + " max-w-sm"} value={config.merchantVatNumber ?? ""} onChange={(e) => setConfig({ ...config, merchantVatNumber: e.target.value })} onBlur={() => saveConfig({ merchantVatNumber: config.merchantVatNumber })} placeholder="e.g. DE123456789" />
        </div>
      </DarkCard>
      <DarkCard title={`Country Tax Rates (${rates.length})`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-[#5a6a84] flex items-center gap-1"><Globe className="h-4 w-4" /> Country Rates</span>
          <div className="flex gap-2">
            <input
              className="rounded border border-[#2e3340] bg-[#0f1117] px-2 py-1 text-[12px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none w-48"
              placeholder="Search countries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-3 w-3" />Add</Button>
          </div>
        </div>
        <div className="rounded-md border border-[#2e3340] overflow-hidden">
          <div className="grid grid-cols-[60px_1fr_100px_80px_60px] gap-2 px-3 py-2 bg-[#1e2128] text-[10.5px] font-bold uppercase tracking-widest text-[#5a6a84] border-b border-[#2a2e3a]">
            <span>Code</span><span>Country</span><span>Rate</span><span>Active</span><span></span>
          </div>
          <div className="max-h-[400px] overflow-y-auto divide-y divide-[#1f2840]">
            {filteredRates.map((r) => (
              <div key={r.id} className="grid grid-cols-[60px_1fr_100px_80px_60px] gap-2 px-3 py-2 items-center text-sm bg-[#0f1117] hover:bg-[#111825]">
                <Badge variant="outline" className="text-xs font-mono w-fit">{r.countryCode}</Badge>
                <span className="text-[#dde4f0]">{r.countryName}</span>
                <button onClick={() => { setEditingRate(r); setEditRate(r.rate); }} className="text-left hover:text-sky-400 flex items-center gap-1 text-[#dde4f0]">{r.rate}%<Percent className="h-3 w-3 opacity-50" /></button>
                <Switch checked={r.isEnabled} onCheckedChange={(v) => updateRate(r.id, { isEnabled: v })} className="scale-90" />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRate(r.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
              </div>
            ))}
            {filteredRates.length === 0 && <p className="text-center py-6 text-sm text-[#5a6a84]">No rates found</p>}
          </div>
        </div>
      </DarkCard>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Country Tax Rate</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><label className={labelCls}>Country Code (2-letter)</label><input className={inputCls} value={newCountryCode} onChange={(e) => setNewCountryCode(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} placeholder="US" /></div>
            <div><label className={labelCls}>Country Name</label><input className={inputCls} value={newCountryName} onChange={(e) => setNewCountryName(e.target.value)} placeholder="United States" /></div>
            <div><label className={labelCls}>Tax Rate (%)</label><input className={inputCls} value={newRate} onChange={(e) => setNewRate(e.target.value)} type="number" step="0.01" placeholder="10" /></div>
          </div>
          <DialogFooter><Button onClick={addRate} disabled={!newCountryCode || !newCountryName || !newRate}>Add Rate</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editingRate} onOpenChange={() => setEditingRate(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Rate: {editingRate?.countryName}</DialogTitle></DialogHeader>
          <div className="py-2">
            <label className={labelCls}>Tax Rate (%)</label>
            <input className={inputCls} value={editRate} onChange={(e) => setEditRate(e.target.value)} type="number" step="0.01" />
          </div>
          <DialogFooter><Button onClick={() => { if (editingRate) { updateRate(editingRate.id, { rate: editRate }); setEditingRate(null); } }}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
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

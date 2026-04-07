import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Plus, Percent, Globe, Building2, Receipt } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

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

  if (!config) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tax / VAT Settings</h1>
        <p className="text-sm text-muted-foreground">Configure tax rates and VAT settings for checkout</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" />General Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Label className="font-medium">Enable Tax Calculation</Label><p className="text-xs text-muted-foreground">Apply tax to orders based on customer location</p></div>
            <Switch checked={config.enabled} onCheckedChange={(v) => saveConfig({ enabled: v })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Price Display</Label>
              <Select value={config.priceDisplay} onValueChange={(v) => saveConfig({ priceDisplay: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exclusive">Exclusive of tax</SelectItem>
                  <SelectItem value="inclusive">Inclusive of tax</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tax Label</Label>
              <Input value={config.taxLabel} onChange={(e) => setConfig({ ...config, taxLabel: e.target.value })} onBlur={() => saveConfig({ taxLabel: config.taxLabel })} className="mt-1" />
            </div>
            <div>
              <Label>Default Tax Rate (%)</Label>
              <Input value={config.defaultRate} onChange={(e) => setConfig({ ...config, defaultRate: e.target.value })} onBlur={() => saveConfig({ defaultRate: config.defaultRate })} className="mt-1" type="number" step="0.01" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" />B2B / VAT Exemption</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Label className="font-medium">B2B Tax Exemption</Label><p className="text-xs text-muted-foreground">Allow business customers to enter a VAT number for tax exemption</p></div>
            <Switch checked={config.b2bExemptionEnabled} onCheckedChange={(v) => saveConfig({ b2bExemptionEnabled: v })} />
          </div>
          <div>
            <Label>Merchant VAT Number</Label>
            <Input value={config.merchantVatNumber ?? ""} onChange={(e) => setConfig({ ...config, merchantVatNumber: e.target.value })} onBlur={() => saveConfig({ merchantVatNumber: config.merchantVatNumber })} placeholder="e.g. DE123456789" className="mt-1 max-w-sm" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />Country Tax Rates ({rates.length})</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="Search countries..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-48 h-8 text-sm" />
              <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-3 w-3" />Add</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="grid grid-cols-[60px_1fr_100px_80px_60px] gap-2 px-3 py-2 bg-gray-50 text-xs font-medium text-muted-foreground border-b">
              <span>Code</span><span>Country</span><span>Rate</span><span>Active</span><span></span>
            </div>
            <div className="max-h-[400px] overflow-y-auto divide-y">
              {filteredRates.map((r) => (
                <div key={r.id} className="grid grid-cols-[60px_1fr_100px_80px_60px] gap-2 px-3 py-2 items-center text-sm">
                  <Badge variant="outline" className="text-xs font-mono w-fit">{r.countryCode}</Badge>
                  <span>{r.countryName}</span>
                  <button onClick={() => { setEditingRate(r); setEditRate(r.rate); }} className="text-left hover:text-blue-600 flex items-center gap-1">{r.rate}%<Percent className="h-3 w-3 opacity-50" /></button>
                  <Switch checked={r.isEnabled} onCheckedChange={(v) => updateRate(r.id, { isEnabled: v })} className="scale-90" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRate(r.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                </div>
              ))}
              {filteredRates.length === 0 && <p className="text-center py-6 text-sm text-muted-foreground">No rates found</p>}
            </div>
          </div>
        </CardContent>
      </Card>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Country Tax Rate</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Country Code (2-letter)</Label><Input value={newCountryCode} onChange={(e) => setNewCountryCode(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} className="mt-1" placeholder="US" /></div>
            <div><Label>Country Name</Label><Input value={newCountryName} onChange={(e) => setNewCountryName(e.target.value)} className="mt-1" placeholder="United States" /></div>
            <div><Label>Tax Rate (%)</Label><Input value={newRate} onChange={(e) => setNewRate(e.target.value)} className="mt-1" type="number" step="0.01" placeholder="10" /></div>
          </div>
          <DialogFooter><Button onClick={addRate} disabled={!newCountryCode || !newCountryName || !newRate}>Add Rate</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editingRate} onOpenChange={() => setEditingRate(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Rate: {editingRate?.countryName}</DialogTitle></DialogHeader>
          <div className="py-2"><Label>Tax Rate (%)</Label><Input value={editRate} onChange={(e) => setEditRate(e.target.value)} className="mt-1" type="number" step="0.01" /></div>
          <DialogFooter><Button onClick={() => { if (editingRate) { updateRate(editingRate.id, { rate: editRate }); setEditingRate(null); } }}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

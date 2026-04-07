import { useEffect, useState, useCallback } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";
const ic = "w-full rounded-md border px-3 py-2 text-sm";

interface Currency { id: number; currencyCode: string; symbol: string; rateToUsd: string; enabled: boolean; }

export default function SettingsCurrenciesTab() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [newRate, setNewRate] = useState("1");
  const [loaded, setLoaded] = useState(false);
  const token = useAuthStore((s) => s.token);

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) { const e = await r.json().catch(() => ({ error: "Failed" })); alert(e.error); return null; }
    return r.json();
  }, [token]);

  const load = useCallback(() => {
    api("/admin/settings/currencies").then((d) => { if (d) { setCurrencies(d.currencies); setDefaultCurrency(d.defaultCurrency); } setLoaded(true); });
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const updateRate = async (id: number, rateToUsd: string) => {
    setCurrencies((p) => p.map((c) => (c.id === id ? { ...c, rateToUsd } : c)));
  };

  const updateSymbol = async (id: number, symbol: string) => {
    setCurrencies((p) => p.map((c) => (c.id === id ? { ...c, symbol } : c)));
  };

  const saveRow = async (c: Currency) => {
    await api(`/admin/settings/currencies/${c.id}`, { method: "PUT", body: JSON.stringify({ rateToUsd: c.rateToUsd, symbol: c.symbol }) });
  };

  const toggleEnabled = async (c: Currency) => {
    const enabled = !c.enabled;
    setCurrencies((p) => p.map((x) => (x.id === c.id ? { ...x, enabled } : x)));
    await api(`/admin/settings/currencies/${c.id}`, { method: "PUT", body: JSON.stringify({ enabled }) });
  };

  const deleteCurrency = async (id: number) => {
    if (!confirm("Delete this currency?")) return;
    await api(`/admin/settings/currencies/${id}`, { method: "DELETE" });
    setCurrencies((p) => p.filter((c) => c.id !== id));
  };

  const addCurrency = async () => {
    if (!newCode.trim() || newCode.trim().length !== 3) { alert("Currency code must be 3 characters"); return; }
    const d = await api("/admin/settings/currencies", { method: "POST", body: JSON.stringify({ currencyCode: newCode.trim(), symbol: newSymbol.trim() || "$", rateToUsd: newRate }) });
    if (d) { setCurrencies((p) => [...p, d]); setShowAdd(false); setNewCode(""); setNewSymbol(""); setNewRate("1"); }
  };

  const saveDefault = async (code: string) => {
    setDefaultCurrency(code);
    await api("/admin/settings/currencies/default", { method: "PUT", body: JSON.stringify({ defaultCurrency: code }) });
  };

  if (!loaded) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Default Currency</h3>
          <select className="rounded-md border px-3 py-1.5 text-sm" value={defaultCurrency} onChange={(e) => saveDefault(e.target.value)}>
            {currencies.filter((c) => c.enabled).map((c) => <option key={c.currencyCode} value={c.currencyCode}>{c.currencyCode} ({c.symbol})</option>)}
            {!currencies.some((c) => c.enabled && c.currencyCode === defaultCurrency) && <option value={defaultCurrency}>{defaultCurrency}</option>}
          </select>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Currency Rates</h3>
          <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-3 w-3 mr-1" /> Add Currency</Button>
        </div>

        {showAdd && (
          <div className="border rounded-md p-4 bg-gray-50 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-xs font-medium mb-1">Code</label><input className={ic} maxLength={3} value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="EUR" /></div>
              <div><label className="block text-xs font-medium mb-1">Symbol</label><input className={ic} maxLength={5} value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="€" /></div>
              <div><label className="block text-xs font-medium mb-1">Rate to USD</label><input type="number" step="0.000001" min="0" className={ic} value={newRate} onChange={(e) => setNewRate(e.target.value)} /></div>
            </div>
            <div className="flex gap-2"><Button size="sm" onClick={addCurrency}>Add</Button><Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button></div>
          </div>
        )}

        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr><th className="text-left px-4 py-2 font-medium">Code</th><th className="text-left px-4 py-2 font-medium">Symbol</th><th className="text-left px-4 py-2 font-medium">Rate to USD</th><th className="text-center px-4 py-2 font-medium">Status</th><th className="text-right px-4 py-2 font-medium">Actions</th></tr>
            </thead>
            <tbody>
              {currencies.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono font-medium">{c.currencyCode}</td>
                  <td className="px-4 py-2"><input className="w-16 rounded border px-2 py-1 text-sm" value={c.symbol} onChange={(e) => updateSymbol(c.id, e.target.value)} /></td>
                  <td className="px-4 py-2"><input type="number" step="0.000001" min="0" className="w-32 rounded border px-2 py-1 text-sm font-mono" value={c.rateToUsd} onChange={(e) => updateRate(c.id, e.target.value)} /></td>
                  <td className="px-4 py-2 text-center"><button onClick={() => toggleEnabled(c)}><Badge variant={c.enabled ? "default" : "secondary"}>{c.enabled ? "Active" : "Disabled"}</Badge></button></td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => saveRow(c)}><Save className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteCurrency(c.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {currencies.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No currencies configured</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

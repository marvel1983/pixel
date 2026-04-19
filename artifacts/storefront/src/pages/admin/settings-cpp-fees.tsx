import { useEffect, useState, useCallback } from "react";
import { Save, Calculator, Shield, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";
const ic = "w-full rounded-md border px-3 py-2 text-sm";

interface Tier { minAmount: number; feePercent: number; feeFixed: number }
interface CppFees {
  cppEnabled: boolean; cppLabel: string; cppPrice: string; cppDescription: string;
  processingFeePercent: string; processingFeeFixed: string;
  processingFeeTiers: Tier[];
}

const defaults: CppFees = {
  cppEnabled: false, cppLabel: "Checkout Protection Plan", cppPrice: "0.99", cppDescription: "",
  processingFeePercent: "0", processingFeeFixed: "0", processingFeeTiers: [],
};

function applyTier(feeBase: number, tiers: Tier[], flatPct: number, flatFixed: number): number {
  if (tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => b.minAmount - a.minAmount);
    const t = sorted.find((t) => feeBase >= t.minAmount) ?? sorted[sorted.length - 1];
    return Math.round((feeBase * t.feePercent / 100 + t.feeFixed) * 100) / 100;
  }
  return Math.round((feeBase * flatPct / 100 + flatFixed) * 100) / 100;
}

export default function SettingsCppFeesTab() {
  const [form, setForm] = useState<CppFees>(defaults);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const token = useAuthStore((s) => s.token);

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) { const e = await r.json().catch(() => ({ error: "Failed" })); alert(e.error); return null; }
    return r.json();
  }, [token]);

  useEffect(() => { api("/admin/settings/cpp-fees").then((d) => { if (d) setForm({ ...defaults, ...d, processingFeeTiers: d.processingFeeTiers ?? [] }); setLoaded(true); }); }, [api]);

  const set = (key: keyof CppFees, val: unknown) => setForm((p) => ({ ...p, [key]: val }));

  const addTier = () => setForm((p) => ({
    ...p,
    processingFeeTiers: [...p.processingFeeTiers, { minAmount: 0, feePercent: 0, feeFixed: 0 }],
  }));

  const updateTier = (i: number, field: keyof Tier, val: string) =>
    setForm((p) => {
      const tiers = [...p.processingFeeTiers];
      tiers[i] = { ...tiers[i], [field]: parseFloat(val) || 0 };
      return { ...p, processingFeeTiers: tiers };
    });

  const removeTier = (i: number) =>
    setForm((p) => ({ ...p, processingFeeTiers: p.processingFeeTiers.filter((_, idx) => idx !== i) }));

  const save = async () => { setSaving(true); const ok = await api("/admin/settings/cpp-fees", { method: "PUT", body: JSON.stringify(form) }); setSaving(false); if (ok) alert("Saved!"); };

  const useTiers = form.processingFeeTiers.length > 0;
  const sortedTiers = [...form.processingFeeTiers].sort((a, b) => a.minAmount - b.minAmount);
  const flatPct = Number(form.processingFeePercent) || 0;
  const flatFixed = Number(form.processingFeeFixed) || 0;
  const cppAmount = form.cppEnabled ? Number(form.cppPrice) || 0 : 0;
  const examples = [9.99, 24.99, 49.99, 99.99, 199.99];

  if (!loaded) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* CPP */}
      <div className="rounded-lg border bg-white p-5 space-y-4">
        <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-blue-600" /><h3 className="font-semibold">Checkout Protection Plan (CPP)</h3></div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.cppEnabled} onChange={(e) => set("cppEnabled", e.target.checked)} className="rounded" />
          <span className="text-sm font-medium">Enable CPP at checkout</span>
        </label>
        {form.cppEnabled && (
          <div className="space-y-3 pl-6 border-l-2 border-blue-200">
            <Field label="Label"><input className={ic} value={form.cppLabel} onChange={(e) => set("cppLabel", e.target.value)} /></Field>
            <Field label="Price (EUR)"><input type="number" step="0.01" min="0" className={ic} value={form.cppPrice} onChange={(e) => set("cppPrice", e.target.value)} /></Field>
            <Field label="Description"><textarea className={`${ic} min-h-[60px] resize-y`} value={form.cppDescription} onChange={(e) => set("cppDescription", e.target.value)} /></Field>
          </div>
        )}
      </div>

      {/* Processing fees */}
      <div className="rounded-lg border bg-white p-5 space-y-4">
        <div className="flex items-center gap-2"><Calculator className="h-5 w-5 text-orange-600" /><h3 className="font-semibold">Processing Fees</h3></div>

        {/* Flat fee */}
        <div className={`space-y-3 ${useTiers ? "opacity-40 pointer-events-none" : ""}`}>
          <p className="text-xs text-muted-foreground">Flat fee — applied to every order. Overridden when tiers are configured below.</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fee Percentage (%)">
              <input type="number" step="0.01" min="0" max="100" className={ic} value={form.processingFeePercent} onChange={(e) => set("processingFeePercent", e.target.value)} />
            </Field>
            <Field label="Fixed Fee (EUR)">
              <input type="number" step="0.01" min="0" className={ic} value={form.processingFeeFixed} onChange={(e) => set("processingFeeFixed", e.target.value)} />
            </Field>
          </div>
        </div>

        {/* Tiered fee */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Tiered Fees</p>
              <p className="text-xs text-muted-foreground">When tiers are set, they replace the flat fee above. The tier with the highest "Order ≥" value that is still ≤ the order total is used.</p>
            </div>
            <button onClick={addTier} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded px-2 py-1">
              <Plus className="h-3.5 w-3.5" /> Add tier
            </button>
          </div>

          {form.processingFeeTiers.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No tiers configured — flat fee is used.</p>
          )}

          {form.processingFeeTiers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-3 py-2 text-xs font-semibold text-gray-600 border-b">Order total ≥ (€)</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-600 border-b">Fee %</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-600 border-b">Fixed (€)</th>
                    <th className="px-3 py-2 border-b w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.processingFeeTiers.map((tier, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="0.01" className="w-full rounded border px-2 py-1 text-sm" value={tier.minAmount} onChange={(e) => updateTier(i, "minAmount", e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" max="100" step="0.01" className="w-full rounded border px-2 py-1 text-sm" value={tier.feePercent} onChange={(e) => updateTier(i, "feePercent", e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="0.01" className="w-full rounded border px-2 py-1 text-sm" value={tier.feeFixed} onChange={(e) => updateTier(i, "feeFixed", e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeTier(i)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Live calculator */}
      <div className="rounded-lg border bg-blue-50 border-blue-200 p-5 space-y-3">
        <div className="flex items-center gap-2"><Calculator className="h-5 w-5 text-blue-600" /><h3 className="font-semibold text-blue-800">Live Fee Calculator</h3></div>
        <p className="text-xs text-blue-700">
          {useTiers ? "Showing fee applied per order total tier:" : `Example checkouts with flat fee (${flatPct}% + €${flatFixed.toFixed(2)}):`}
        </p>
        <div className="bg-white rounded-md p-4 space-y-2 text-sm">
          {examples.map((price) => {
            const feeBase = price + cppAmount;
            const fee = applyTier(feeBase, sortedTiers, flatPct, flatFixed);
            const total = feeBase + fee;
            const matchedTier = useTiers
              ? sortedTiers.slice().reverse().find((t) => feeBase >= t.minAmount)
              : null;
            return (
              <div key={price} className="flex justify-between items-center py-1 border-b last:border-0">
                <span className="text-gray-600">
                  €{price.toFixed(2)} order
                  {matchedTier && <span className="ml-2 text-[11px] text-orange-500">(tier ≥€{matchedTier.minAmount}: {matchedTier.feePercent}% + €{matchedTier.feeFixed.toFixed(2)})</span>}
                </span>
                <span className="font-mono text-right">
                  <span className="text-orange-600 text-xs mr-2">+€{fee.toFixed(2)}</span>
                  <span className="font-bold">€{total.toFixed(2)}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end"><Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Settings"}</Button></div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium mb-1">{label}</label>{children}</div>;
}

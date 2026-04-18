import { useEffect, useState, useCallback } from "react";
import { Save, Calculator, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";
const ic = "w-full rounded-md border px-3 py-2 text-sm";

interface CppFees {
  cppEnabled: boolean; cppLabel: string; cppPrice: string; cppDescription: string;
  processingFeePercent: string; processingFeeFixed: string;
}

const defaults: CppFees = { cppEnabled: false, cppLabel: "Checkout Protection Plan", cppPrice: "0.99", cppDescription: "", processingFeePercent: "0", processingFeeFixed: "0" };

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

  useEffect(() => { api("/admin/settings/cpp-fees").then((d) => { if (d) setForm({ ...defaults, ...d }); setLoaded(true); }); }, [api]);

  const set = (key: keyof CppFees, val: unknown) => setForm((p) => ({ ...p, [key]: val }));

  const save = async () => { setSaving(true); const ok = await api("/admin/settings/cpp-fees", { method: "PUT", body: JSON.stringify(form) }); setSaving(false); if (ok) alert("Saved!"); };

  const examplePrice = 49.99;
  const feePercent = Number(form.processingFeePercent) || 0;
  const feeFixed = Number(form.processingFeeFixed) || 0;
  const cppAmount = form.cppEnabled ? Number(form.cppPrice) || 0 : 0;
  const processingFee = (examplePrice * feePercent) / 100 + feeFixed;
  const total = examplePrice + cppAmount + processingFee;

  if (!loaded) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-5 space-y-4">
        <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-blue-600" /><h3 className="font-semibold">Checkout Protection Plan (CPP)</h3></div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.cppEnabled} onChange={(e) => set("cppEnabled", e.target.checked)} className="rounded" />
          <span className="text-sm font-medium">Enable CPP at checkout</span>
        </label>
        {form.cppEnabled && (
          <div className="space-y-3 pl-6 border-l-2 border-blue-200">
            <Field label="Label"><input className={ic} value={form.cppLabel} onChange={(e) => set("cppLabel", e.target.value)} /></Field>
            <Field label="Price (USD)"><input type="number" step="0.01" min="0" className={ic} value={form.cppPrice} onChange={(e) => set("cppPrice", e.target.value)} /></Field>
            <Field label="Description"><textarea className={`${ic} min-h-[60px] resize-y`} value={form.cppDescription} onChange={(e) => set("cppDescription", e.target.value)} /></Field>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white p-5 space-y-4">
        <div className="flex items-center gap-2"><Calculator className="h-5 w-5 text-orange-600" /><h3 className="font-semibold">Processing Fees</h3></div>
        <p className="text-xs text-muted-foreground">Fees applied to every order at checkout. Set both to 0 for no processing fee.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fee Percentage (%)"><input type="number" step="0.01" min="0" max="100" className={ic} value={form.processingFeePercent} onChange={(e) => set("processingFeePercent", e.target.value)} /></Field>
          <Field label="Fixed Fee (USD)"><input type="number" step="0.01" min="0" className={ic} value={form.processingFeeFixed} onChange={(e) => set("processingFeeFixed", e.target.value)} /></Field>
        </div>
      </div>

      <div className="rounded-lg border bg-blue-50 border-blue-200 p-5 space-y-3">
        <div className="flex items-center gap-2"><Calculator className="h-5 w-5 text-blue-600" /><h3 className="font-semibold text-blue-800">Live Fee Calculator</h3></div>
        <p className="text-xs text-blue-700">Example checkout with a ${examplePrice.toFixed(2)} product</p>
        <div className="bg-white rounded-md p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span>Product subtotal</span><span className="font-mono">${examplePrice.toFixed(2)}</span></div>
          {form.cppEnabled && <div className="flex justify-between text-blue-600"><span>CPP ({form.cppLabel})</span><span className="font-mono">+${cppAmount.toFixed(2)}</span></div>}
          {processingFee > 0 && <div className="flex justify-between text-orange-600"><span>Processing fee ({feePercent}% + ${feeFixed.toFixed(2)})</span><span className="font-mono">+${processingFee.toFixed(2)}</span></div>}
          <div className="flex justify-between font-bold pt-2 border-t"><span>Total</span><span className="font-mono">${total.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="flex justify-end"><Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Settings"}</Button></div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium mb-1">{label}</label>{children}</div>;
}

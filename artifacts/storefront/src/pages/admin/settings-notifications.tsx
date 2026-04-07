import { useEffect, useState, useCallback } from "react";
import { Save, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Prefs {
  orderAlerts: boolean; orderAlertsEmail: boolean;
  stockAlerts: boolean; stockThreshold: string;
  customerAlerts: boolean;
  reviewAlerts: boolean; reviewMinRating: string;
  claimAlerts: boolean;
  paymentAlerts: boolean; paymentFailedOnly: boolean;
  systemAlerts: boolean;
  dailyDigest: boolean; dailyDigestTime: string;
  dailyDigestRecipients: string[];
}

const defaults: Prefs = {
  orderAlerts: true, orderAlertsEmail: true,
  stockAlerts: true, stockThreshold: "5",
  customerAlerts: true,
  reviewAlerts: true, reviewMinRating: "1",
  claimAlerts: true,
  paymentAlerts: true, paymentFailedOnly: false,
  systemAlerts: true,
  dailyDigest: false, dailyDigestTime: "09:00",
  dailyDigestRecipients: [],
};

export default function SettingsNotificationsTab() {
  const [form, setForm] = useState<Prefs>(defaults);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const token = useAuthStore((s) => s.token);

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) return null;
    return r.json();
  }, [token]);

  useEffect(() => {
    api("/admin/settings/notifications").then((d) => {
      if (d?.preferences) setForm({ ...defaults, ...d.preferences });
      setLoaded(true);
    });
  }, [api]);

  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setForm((p) => ({ ...p, [k]: v }));

  const addRecipient = () => {
    const e = newEmail.trim();
    if (e && e.includes("@") && !form.dailyDigestRecipients.includes(e)) {
      set("dailyDigestRecipients", [...form.dailyDigestRecipients, e]);
      setNewEmail("");
    }
  };

  const removeRecipient = (email: string) => {
    set("dailyDigestRecipients", form.dailyDigestRecipients.filter((r) => r !== email));
  };

  const save = async () => {
    setSaving(true);
    await api("/admin/settings/notifications", { method: "PUT", body: JSON.stringify(form) });
    setSaving(false);
    alert("Notification preferences saved!");
  };

  if (!loaded) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <Section title="Order Alerts">
        <Toggle label="Enable order notifications" checked={form.orderAlerts} onChange={(v) => set("orderAlerts", v)} />
        {form.orderAlerts && <Toggle label="Send email for each new order" checked={form.orderAlertsEmail} onChange={(v) => set("orderAlertsEmail", v)} />}
      </Section>

      <Section title="Stock Alerts">
        <Toggle label="Enable low stock notifications" checked={form.stockAlerts} onChange={(v) => set("stockAlerts", v)} />
        {form.stockAlerts && (
          <Field label="Low stock threshold">
            <input type="number" min="1" className="w-24 rounded-md border px-3 py-2 text-sm" value={form.stockThreshold} onChange={(e) => set("stockThreshold", e.target.value)} />
          </Field>
        )}
      </Section>

      <Section title="Customer Alerts">
        <Toggle label="Notify on new customer registrations" checked={form.customerAlerts} onChange={(v) => set("customerAlerts", v)} />
      </Section>

      <Section title="Review Alerts">
        <Toggle label="Enable review notifications" checked={form.reviewAlerts} onChange={(v) => set("reviewAlerts", v)} />
        {form.reviewAlerts && (
          <Field label="Minimum star rating to notify">
            <select className="rounded-md border px-3 py-2 text-sm" value={form.reviewMinRating} onChange={(e) => set("reviewMinRating", e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={String(n)}>{n} star{n > 1 ? "s" : ""} and above</option>)}
            </select>
          </Field>
        )}
      </Section>

      <Section title="Claim Alerts">
        <Toggle label="Notify on new claims" checked={form.claimAlerts} onChange={(v) => set("claimAlerts", v)} />
      </Section>

      <Section title="Payment Alerts">
        <Toggle label="Enable payment notifications" checked={form.paymentAlerts} onChange={(v) => set("paymentAlerts", v)} />
        {form.paymentAlerts && <Toggle label="Only notify on failed payments" checked={form.paymentFailedOnly} onChange={(v) => set("paymentFailedOnly", v)} />}
      </Section>

      <Section title="System Alerts">
        <Toggle label="Notify on system errors and warnings" checked={form.systemAlerts} onChange={(v) => set("systemAlerts", v)} />
      </Section>

      <Section title="Daily Digest Email">
        <Toggle label="Send daily summary digest" checked={form.dailyDigest} onChange={(v) => set("dailyDigest", v)} />
        {form.dailyDigest && (
          <>
            <Field label="Send time">
              <input type="time" className="rounded-md border px-3 py-2 text-sm" value={form.dailyDigestTime} onChange={(e) => set("dailyDigestTime", e.target.value)} />
            </Field>
            <Field label="Recipients">
              <div className="flex flex-wrap gap-2 mb-2">
                {form.dailyDigestRecipients.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                    {e} <button type="button" onClick={() => removeRecipient(e)}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="flex-1 rounded-md border px-3 py-2 text-sm" placeholder="admin@example.com" value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRecipient())} />
                <Button variant="outline" size="sm" type="button" onClick={addRecipient}><Plus className="h-4 w-4 mr-1" /> Add</Button>
              </div>
            </Field>
          </>
        )}
      </Section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Preferences"}</Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border bg-white p-5 space-y-3"><h3 className="font-semibold">{title}</h3>{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="ml-7 space-y-1"><label className="block text-sm font-medium text-muted-foreground">{label}</label>{children}</div>;
}

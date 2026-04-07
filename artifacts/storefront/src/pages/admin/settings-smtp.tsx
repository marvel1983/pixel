import { useEffect, useState, useCallback } from "react";
import { Save, Send, Mail, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";
const ic = "w-full rounded-md border px-3 py-2 text-sm";

interface SmtpForm { smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string; smtpFrom: string; smtpSecure: boolean; hasPassword: boolean; }
interface QueueItem { id: number; to: string; subject: string; status: string; attempts: number; lastError: string | null; createdAt: string; }
interface QueueCounts { total: number; pending: number; sent: number; failed: number; }

const defaults: SmtpForm = { smtpHost: "", smtpPort: 587, smtpUser: "", smtpPass: "", smtpFrom: "", smtpSecure: false, hasPassword: false };

export default function SettingsSmtpTab() {
  const [form, setForm] = useState<SmtpForm>(defaults);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [queue, setQueue] = useState<{ counts: QueueCounts; recent: QueueItem[] } | null>(null);
  const token = useAuthStore((s) => s.token);

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) { const e = await r.json().catch(() => ({ error: "Failed" })); alert(e.error); return null; }
    return r.json();
  }, [token]);

  useEffect(() => {
    api("/admin/settings/smtp").then((d) => { if (d) setForm({ ...defaults, ...d, smtpPass: "" }); setLoaded(true); });
    api("/admin/settings/smtp/queue-status").then((d) => { if (d) setQueue(d); });
  }, [api]);

  const set = (key: keyof SmtpForm, val: unknown) => setForm((p) => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true);
    const body: Record<string, unknown> = { smtpHost: form.smtpHost, smtpPort: form.smtpPort, smtpUser: form.smtpUser, smtpFrom: form.smtpFrom, smtpSecure: form.smtpSecure };
    if (form.smtpPass) body.smtpPass = form.smtpPass;
    await api("/admin/settings/smtp", { method: "PUT", body: JSON.stringify(body) });
    setSaving(false);
    setForm((p) => ({ ...p, hasPassword: p.hasPassword || !!p.smtpPass, smtpPass: "" }));
    alert("SMTP settings saved!");
  };

  const sendTest = async () => {
    setTestResult(null);
    const d = await api("/admin/settings/smtp/test", { method: "POST", body: JSON.stringify({ to: testEmail }) });
    if (d) setTestResult(d);
    api("/admin/settings/smtp/queue-status").then((d) => { if (d) setQueue(d); });
  };

  if (!loaded) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-5 space-y-4">
        <div className="flex items-center gap-2"><Mail className="h-5 w-5 text-blue-600" /><h3 className="font-semibold">SMTP Configuration</h3></div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="SMTP Host"><input className={ic} value={form.smtpHost} onChange={(e) => set("smtpHost", e.target.value)} placeholder="smtp.gmail.com" /></Field>
          <Field label="Port"><input type="number" className={ic} value={form.smtpPort} onChange={(e) => set("smtpPort", Number(e.target.value))} /></Field>
          <Field label="Username"><input className={ic} value={form.smtpUser} onChange={(e) => set("smtpUser", e.target.value)} /></Field>
          <Field label="Password">
            <input type="password" autoComplete="new-password" className={ic} value={form.smtpPass} onChange={(e) => set("smtpPass", e.target.value)} placeholder={form.hasPassword ? "••••••••(unchanged)" : "Enter password"} />
          </Field>
        </div>
        <Field label="From Address"><input type="email" className={ic} value={form.smtpFrom} onChange={(e) => set("smtpFrom", e.target.value)} placeholder="noreply@pixelcodes.com" /></Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.smtpSecure} onChange={(e) => set("smtpSecure", e.target.checked)} className="rounded" />
          <span className="text-sm">Use SSL/TLS (port 465)</span>
        </label>
        <div className="flex justify-end"><Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save SMTP"}</Button></div>
      </div>

      <div className="rounded-lg border bg-white p-5 space-y-4">
        <h3 className="font-semibold">Send Test Email</h3>
        <div className="flex gap-2">
          <input type="email" className={`${ic} flex-1`} value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" />
          <Button onClick={sendTest} disabled={!testEmail.includes("@")}><Send className="h-4 w-4 mr-1" /> Send Test</Button>
        </div>
        {testResult && <p className={`text-sm ${testResult.success ? "text-green-600" : "text-red-600"}`}>{testResult.message}</p>}
      </div>

      {queue && (
        <div className="rounded-lg border bg-white p-5 space-y-4">
          <h3 className="font-semibold">Email Queue Status</h3>
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Total" value={queue.counts.total} icon={<Mail className="h-4 w-4 text-gray-500" />} />
            <StatCard label="Pending" value={queue.counts.pending} icon={<Clock className="h-4 w-4 text-yellow-500" />} />
            <StatCard label="Sent" value={queue.counts.sent} icon={<CheckCircle className="h-4 w-4 text-green-500" />} />
            <StatCard label="Failed" value={queue.counts.failed} icon={<AlertCircle className="h-4 w-4 text-red-500" />} />
          </div>
          {queue.recent.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b"><tr><th className="text-left px-3 py-2">To</th><th className="text-left px-3 py-2">Subject</th><th className="text-center px-3 py-2">Status</th><th className="text-center px-3 py-2">Attempts</th><th className="text-left px-3 py-2">Created</th></tr></thead>
                <tbody>
                  {queue.recent.map((q) => (
                    <tr key={q.id} className="border-b last:border-0">
                      <td className="px-3 py-2 truncate max-w-[120px]">{q.to}</td>
                      <td className="px-3 py-2 truncate max-w-[160px]">{q.subject}</td>
                      <td className="px-3 py-2 text-center"><Badge variant={q.status === "sent" ? "default" : q.status === "failed" ? "destructive" : "secondary"}>{q.status}</Badge></td>
                      <td className="px-3 py-2 text-center">{q.attempts}</td>
                      <td className="px-3 py-2 text-muted-foreground">{new Date(q.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium mb-1">{label}</label>{children}</div>;
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="border rounded-md p-3 text-center"><div className="flex justify-center mb-1">{icon}</div><p className="text-lg font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}

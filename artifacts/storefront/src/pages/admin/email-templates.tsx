import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Mail, Pencil, Send, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

const inputCls = "w-full rounded border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const labelCls = "block text-[11.5px] font-medium text-[#8fa0bb] mb-1";

interface Template {
  id: number; key: string; name: string; subject: string;
  bodyHtml: string; variables: string[]; sampleData: Record<string, string>;
  isEnabled: boolean; updatedAt: string;
}

export default function EmailTemplatesPage() {
  const token = useAuthStore((s) => s.token);
  const [, navigate] = useLocation();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [testModal, setTestModal] = useState<Template | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchTemplates = useCallback(() => {
    fetch(`${API}/admin/email-templates`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setTemplates(d.templates)).catch(() => {});
  }, [token]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const toggleEnabled = async (t: Template) => {
    await fetch(`${API}/admin/email-templates/${t.id}`, { method: "PUT", headers, body: JSON.stringify({ isEnabled: !t.isEnabled }) });
    fetchTemplates();
  };

  const sendTest = async () => {
    if (!testModal || !testEmail) return;
    setSending(true); setTestResult(null);
    const res = await fetch(`${API}/admin/email-templates/${testModal.id}/test`, { method: "POST", headers, body: JSON.stringify({ email: testEmail }) });
    const data = await res.json();
    setTestResult(data.success ? `Test email queued for ${testEmail}` : (data.error || "Failed"));
    setSending(false);
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return d; }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Email Templates</h1>
        <p className="text-sm text-[#5a6a84]">Customize transactional email content, subject lines, and layout</p>
      </div>
      <DarkCard title={`Templates (${templates.length})`}>
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border border-[#2e3340] bg-[#0f1117] p-3 hover:bg-[#111825] transition-colors">
              <Mail className="h-5 w-5 text-[#5a6a84] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-[#dde4f0]">{t.name}</p>
                  <Badge variant="outline" className="text-xs font-mono">{t.key}</Badge>
                </div>
                <p className="text-xs text-[#5a6a84] truncate mt-0.5">{t.subject}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-[#5a6a84] shrink-0">
                <Clock className="h-3 w-3" />{formatDate(t.updatedAt)}
              </div>
              <Switch checked={t.isEnabled} onCheckedChange={() => toggleEnabled(t)} />
              <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/email-templates/${t.id}`)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => { setTestModal(t); setTestEmail(""); setTestResult(null); }}><Send className="h-4 w-4" /></Button>
            </div>
          ))}
          {templates.length === 0 && <p className="text-center py-8 text-[#5a6a84]">Loading templates...</p>}
        </div>
      </DarkCard>
      <Dialog open={!!testModal} onOpenChange={() => setTestModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Test Email: {testModal?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-[#5a6a84]">A test email will be sent using sample data to the address below.</p>
            <div>
              <label className={labelCls}>Recipient Email</label>
              <input className={inputCls} value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" />
            </div>
            {testResult && <p className={`text-sm ${testResult.includes("queued") ? "text-green-400" : "text-red-400"}`}>{testResult}</p>}
          </div>
          <DialogFooter>
            <button
              onClick={sendTest}
              disabled={!testEmail || sending}
              className="flex items-center gap-2 rounded border border-sky-500 bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
            >
              {sending ? "Sending..." : "Send Test"}
            </button>
          </DialogFooter>
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

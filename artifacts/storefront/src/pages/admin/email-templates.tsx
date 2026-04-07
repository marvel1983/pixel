import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Mail, Pencil, Send, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

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
        <p className="text-sm text-muted-foreground">Customize transactional email content, subject lines, and layout</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" />Templates ({templates.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border bg-white p-3 hover:shadow-sm transition-shadow">
                <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{t.name}</p>
                    <Badge variant="outline" className="text-xs font-mono">{t.key}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{t.subject}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" />{formatDate(t.updatedAt)}
                </div>
                <Switch checked={t.isEnabled} onCheckedChange={() => toggleEnabled(t)} />
                <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/email-templates/${t.id}`)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { setTestModal(t); setTestEmail(""); setTestResult(null); }}><Send className="h-4 w-4" /></Button>
              </div>
            ))}
            {templates.length === 0 && <p className="text-center py-8 text-muted-foreground">Loading templates...</p>}
          </div>
        </CardContent>
      </Card>
      <Dialog open={!!testModal} onOpenChange={() => setTestModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Test Email: {testModal?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">A test email will be sent using sample data to the address below.</p>
            <div><Label>Recipient Email</Label><Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" className="mt-1" /></div>
            {testResult && <p className={`text-sm ${testResult.includes("queued") ? "text-green-600" : "text-red-600"}`}>{testResult}</p>}
          </div>
          <DialogFooter><Button onClick={sendTest} disabled={!testEmail || sending}>{sending ? "Sending..." : "Send Test"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

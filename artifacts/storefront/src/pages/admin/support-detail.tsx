import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, User, Headphones, Clock, StickyNote } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Message {
  id: number; body: string; isStaff: boolean; isInternal: boolean;
  createdAt: string; senderName: string;
}
interface TimelineEntry {
  id: number; fromStatus: string | null; toStatus: string;
  note: string | null; createdAt: string; changedBy: string;
}
interface TicketData {
  ticket: {
    id: number; ticketNumber: string; subject: string; status: string;
    priority: string; category: string; orderId: number | null;
    userId: number | null; assigneeId: number | null;
    createdAt: string; updatedAt: string;
    customerEmail: string; customerName: string;
  };
  messages: Message[];
  order: { orderNumber: string; totalUsd: string; status: string } | null;
  assignee: { firstName: string | null; lastName: string | null; email: string } | null;
  timeline: TimelineEntry[];
}
interface Assignee { id: number; firstName: string | null; lastName: string | null; email: string; }

export default function AdminSupportDetailPage() {
  const [, params] = useRoute("/admin/support/:ticketNumber");
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [data, setData] = useState<TicketData | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [replyStatus, setReplyStatus] = useState("NO_CHANGE");
  const [sending, setSending] = useState(false);

  const ticketNumber = params?.ticketNumber;
  const headers = { Authorization: `Bearer ${token}` };

  async function load() {
    if (!ticketNumber) return;
    try {
      const [tRes, aRes] = await Promise.all([
        fetch(`${API}/admin/support/tickets/${ticketNumber}`, { headers, credentials: "include" }),
        fetch(`${API}/admin/support/assignees`, { headers, credentials: "include" }),
      ]);
      if (!tRes.ok) throw new Error("Not found");
      setData(await tRes.json());
      setAssignees(await aRes.json());
    } catch { toast({ title: "Error", description: "Ticket not found", variant: "destructive" }); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [ticketNumber, token]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || !ticketNumber) return;
    setSending(true);
    try {
      const res = await fetch(`${API}/admin/support/tickets/${ticketNumber}/reply`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ message: reply, isInternal, status: replyStatus !== "NO_CHANGE" ? replyStatus : undefined }),
      });
      if (!res.ok) throw new Error("Failed");
      setReply(""); setIsInternal(false); setReplyStatus("NO_CHANGE");
      load();
    } catch { toast({ title: "Error", description: "Failed to reply", variant: "destructive" }); }
    finally { setSending(false); }
  }

  async function updateTicket(updates: Record<string, unknown>) {
    if (!ticketNumber) return;
    const res = await fetch(`${API}/admin/support/tickets/${ticketNumber}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(updates),
    });
    if (!res.ok) { toast({ title: "Error", description: "Failed to update ticket", variant: "destructive" }); return; }
    load();
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return <div className="text-center py-12 text-[#5a6a84]">Ticket not found.</div>;

  const { ticket, messages, order, assignee } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <h1 className="text-xl font-bold text-[#dde4f0]">{ticket.ticketNumber}: {ticket.subject}</h1>
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`p-4 rounded-lg ${msg.isInternal ? "bg-yellow-950/30 border-l-4 border-yellow-500" : msg.isStaff ? "bg-sky-950/30 border-l-4 border-sky-500" : "bg-[#181c24] border border-[#2e3340]"}`}>
              <div className="flex items-center gap-2 mb-2">
                {msg.isInternal ? <StickyNote className="h-4 w-4 text-yellow-400" /> : msg.isStaff ? <Headphones className="h-4 w-4 text-sky-400" /> : <User className="h-4 w-4 text-[#5a6a84]" />}
                <span className="font-medium text-sm text-[#dde4f0]">
                  {msg.isInternal ? "Internal Note" : msg.isStaff ? "Staff" : "Customer"} — {msg.senderName}
                </span>
                <span className="text-xs text-[#5a6a84] ml-auto flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {new Date(msg.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-[#dde4f0] whitespace-pre-wrap">{msg.body}</p>
            </div>
          ))}
        </div>
        <form onSubmit={handleReply} className="space-y-3 border-t border-[#2a2e3a] pt-4">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder={isInternal ? "Add internal note..." : "Reply to customer..."} rows={4} required className={isInternal ? "border-yellow-500 bg-yellow-950/20" : ""} />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={isInternal} onCheckedChange={setIsInternal} id="internal" />
                <label htmlFor="internal" className="text-sm text-[#8fa0bb]">Internal Note</label>
              </div>
              {!isInternal && (
                <Select value={replyStatus} onValueChange={setReplyStatus}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Set status..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO_CHANGE">No change</SelectItem>
                    <SelectItem value="AWAITING_CUSTOMER">Awaiting Customer</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button type="submit" disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {isInternal ? "Add Note" : "Send Reply"}
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <DarkCard title="Ticket Info">
          <Row label="Status">
            <Select value={ticket.status} onValueChange={(v) => updateTicket({ status: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["OPEN", "IN_PROGRESS", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED"].map((s) => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Priority">
            <Select value={ticket.priority} onValueChange={(v) => updateTicket({ priority: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Assignee">
            <Select value={String(ticket.assigneeId ?? "UNASSIGNED")} onValueChange={(v) => updateTicket({ assigneeId: v !== "UNASSIGNED" ? parseInt(v) : null })}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.firstName ?? a.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Category"><Badge variant="secondary">{ticket.category.replace(/_/g, " ")}</Badge></Row>
          <Row label="Created"><span className="text-[12px] text-[#dde4f0]">{new Date(ticket.createdAt).toLocaleString()}</span></Row>
          <Row label="Updated"><span className="text-[12px] text-[#dde4f0]">{new Date(ticket.updatedAt).toLocaleString()}</span></Row>
        </DarkCard>
        <DarkCard title="Customer">
          <p className="font-medium text-[#dde4f0]">{ticket.customerName}</p>
          <p className="text-[#5a6a84] text-sm">{ticket.customerEmail}</p>
        </DarkCard>
        {order && (
          <DarkCard title="Linked Order">
            <p className="font-mono text-[#dde4f0]">{order.orderNumber}</p>
            <p className="text-[#dde4f0] text-sm">${order.totalUsd} — <Badge variant="secondary">{order.status}</Badge></p>
          </DarkCard>
        )}
        {data.timeline.length > 0 && (
          <DarkCard title="Status Timeline">
            {data.timeline.map((t) => (
              <div key={t.id} className="border-l-2 border-sky-700 pl-3">
                <p className="font-medium text-[#dde4f0] text-sm">{t.fromStatus ? `${t.fromStatus} → ${t.toStatus}` : t.toStatus}</p>
                {t.note && <p className="text-[#5a6a84] text-xs">{t.note}</p>}
                <p className="text-xs text-[#5a6a84]">{t.changedBy} · {new Date(t.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </DarkCard>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#5a6a84] text-sm">{label}</span>
      <div>{children}</div>
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

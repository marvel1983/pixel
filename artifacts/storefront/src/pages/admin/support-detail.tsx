import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
      await fetch(`${API}/admin/support/tickets/${ticketNumber}/reply`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ message: reply, isInternal, status: replyStatus !== "NO_CHANGE" ? replyStatus : undefined }),
      });
      setReply(""); setIsInternal(false); setReplyStatus("NO_CHANGE");
      load();
    } catch { toast({ title: "Error", description: "Failed to reply", variant: "destructive" }); }
    finally { setSending(false); }
  }

  async function updateTicket(updates: Record<string, unknown>) {
    if (!ticketNumber) return;
    await fetch(`${API}/admin/support/tickets/${ticketNumber}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(updates),
    });
    load();
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return <div className="text-center py-12 text-muted-foreground">Ticket not found.</div>;

  const { ticket, messages, order, assignee } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <h1 className="text-xl font-bold">{ticket.ticketNumber}: {ticket.subject}</h1>
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`p-4 rounded-lg ${msg.isInternal ? "bg-yellow-50 border-l-4 border-yellow-400" : msg.isStaff ? "bg-blue-50 border-l-4 border-blue-400" : "bg-gray-50"}`}>
              <div className="flex items-center gap-2 mb-2">
                {msg.isInternal ? <StickyNote className="h-4 w-4 text-yellow-600" /> : msg.isStaff ? <Headphones className="h-4 w-4 text-blue-600" /> : <User className="h-4 w-4 text-gray-600" />}
                <span className="font-medium text-sm">
                  {msg.isInternal ? "Internal Note" : msg.isStaff ? "Staff" : "Customer"} — {msg.senderName}
                </span>
                <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {new Date(msg.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
            </div>
          ))}
        </div>
        <form onSubmit={handleReply} className="space-y-3 border-t pt-4">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder={isInternal ? "Add internal note..." : "Reply to customer..."} rows={4} required className={isInternal ? "border-yellow-400 bg-yellow-50" : ""} />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={isInternal} onCheckedChange={setIsInternal} id="internal" />
                <Label htmlFor="internal" className="text-sm">Internal Note</Label>
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
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Ticket Info</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
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
            <Row label="Created">{new Date(ticket.createdAt).toLocaleString()}</Row>
            <Row label="Updated">{new Date(ticket.updatedAt).toLocaleString()}</Row>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Customer</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{ticket.customerName}</p>
            <p className="text-muted-foreground">{ticket.customerEmail}</p>
          </CardContent>
        </Card>
        {order && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Linked Order</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-mono">{order.orderNumber}</p>
              <p>${order.totalUsd} — <Badge variant="secondary">{order.status}</Badge></p>
            </CardContent>
          </Card>
        )}
        {data.timeline.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Status Timeline</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {data.timeline.map((t) => (
                <div key={t.id} className="border-l-2 border-blue-200 pl-3">
                  <p className="font-medium">{t.fromStatus ? `${t.fromStatus} → ${t.toStatus}` : t.toStatus}</p>
                  {t.note && <p className="text-muted-foreground text-xs">{t.note}</p>}
                  <p className="text-xs text-muted-foreground">{t.changedBy} · {new Date(t.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}

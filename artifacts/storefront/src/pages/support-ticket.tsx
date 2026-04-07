import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCircle, RotateCcw, Clock, User, Headphones } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Message {
  id: number; body: string; isStaff: boolean; createdAt: string; senderName: string;
}
interface Ticket {
  id: number; ticketNumber: string; subject: string; status: string;
  priority: string; category: string; createdAt: string; updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800", IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  AWAITING_CUSTOMER: "bg-orange-100 text-orange-800", RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
};

export default function SupportTicketPage() {
  const [, params] = useRoute("/support/tickets/:ticketNumber");
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const ticketNumber = params?.ticketNumber;

  async function load() {
    if (!ticketNumber || !token) return;
    try {
      const res = await fetch(`${API}/support/tickets/${ticketNumber}`, {
        headers: { Authorization: `Bearer ${token}` }, credentials: "include",
      });
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setTicket(data.ticket);
      setMessages(data.messages);
    } catch { toast({ title: "Error", description: "Ticket not found", variant: "destructive" }); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [ticketNumber, token]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || !ticketNumber) return;
    setSending(true);
    try {
      const res = await fetch(`${API}/support/tickets/${ticketNumber}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ message: reply }),
      });
      if (!res.ok) throw new Error("Failed");
      setReply("");
      load();
    } catch { toast({ title: "Error", description: "Failed to send reply", variant: "destructive" }); }
    finally { setSending(false); }
  }

  async function handleAction(action: "resolve" | "reopen") {
    if (!ticketNumber) return;
    await fetch(`${API}/support/tickets/${ticketNumber}/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }, credentials: "include",
    });
    load();
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!ticket) return <div className="text-center py-12 text-muted-foreground">Ticket not found.</div>;

  const canReply = ticket.status !== "CLOSED" && ticket.status !== "RESOLVED";
  const canResolve = ticket.status !== "CLOSED" && ticket.status !== "RESOLVED";
  const canReopen = ticket.status === "RESOLVED" || ticket.status === "CLOSED";

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: "Support", href: "/account?tab=support" }, { label: ticket.ticketNumber }]} />
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">{ticket.subject}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {ticket.ticketNumber} &middot; {ticket.category.replace("_", " ")} &middot; {new Date(ticket.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Badge className={STATUS_COLORS[ticket.status] ?? ""}>{ticket.status.replace("_", " ")}</Badge>
            {canResolve && <Button size="sm" variant="outline" onClick={() => handleAction("resolve")}><CheckCircle className="h-4 w-4 mr-1" /> Resolve</Button>}
            {canReopen && <Button size="sm" variant="outline" onClick={() => handleAction("reopen")}><RotateCcw className="h-4 w-4 mr-1" /> Reopen</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`p-4 rounded-lg ${msg.isStaff ? "bg-blue-50 border-l-4 border-blue-400" : "bg-gray-50"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {msg.isStaff ? <Headphones className="h-4 w-4 text-blue-600" /> : <User className="h-4 w-4 text-gray-600" />}
                  <span className="font-medium text-sm">{msg.isStaff ? "Support Team" : msg.senderName}</span>
                  <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {new Date(msg.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
              </div>
            ))}
          </div>
          {canReply && (
            <form onSubmit={handleReply} className="space-y-3 border-t pt-4">
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply..." rows={4} maxLength={5000} required />
              <Button type="submit" disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send Reply
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2, Plus, MessageSquare, Clock } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Ticket {
  id: number; ticketNumber: string; subject: string; status: string;
  priority: string; category: string; createdAt: string; updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800", IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  AWAITING_CUSTOMER: "bg-orange-100 text-orange-800", RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
};

export function SupportTab() {
  const token = useAuthStore((s) => s.token);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API}/support/tickets?status=${filter}`, {
      headers: { Authorization: `Bearer ${token}` }, credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTickets(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Support Tickets</h2>
        <Link href="/support/new">
          <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Ticket</Button>
        </Link>
      </div>

      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Tickets</SelectItem>
          <SelectItem value="OPEN">Open</SelectItem>
          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
          <SelectItem value="AWAITING_CUSTOMER">Awaiting Reply</SelectItem>
          <SelectItem value="RESOLVED">Resolved</SelectItem>
          <SelectItem value="CLOSED">Closed</SelectItem>
        </SelectContent>
      </Select>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No tickets found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <Link key={t.id} href={`/support/tickets/${t.ticketNumber}`}>
              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">{t.ticketNumber}</span>
                    <Badge className={STATUS_COLORS[t.status] ?? ""} variant="secondary">
                      {t.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="font-medium mt-1 truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.category.replace(/_/g, " ")} &middot; <Clock className="h-3 w-3 inline" /> {new Date(t.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

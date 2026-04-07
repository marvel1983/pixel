import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2, MessageSquare, Clock, AlertCircle, CheckCircle, Hourglass, HeadphonesIcon } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Stats { open: number; inProgress: number; waiting: number; resolved: number; avgResponseHours: number; }
interface Ticket {
  id: number; ticketNumber: string; subject: string; status: string;
  priority: string; category: string; createdAt: string; updatedAt: string;
  customerEmail: string; customerName: string;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800", IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  AWAITING_CUSTOMER: "bg-orange-100 text-orange-800", RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
};
const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700", MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700", URGENT: "bg-red-100 text-red-700",
};

export default function AdminSupportPage() {
  const token = useAuthStore((s) => s.token);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/admin/support/stats`, { headers, credentials: "include" })
      .then((r) => r.json()).then(setStats).catch(() => {});
  }, [token]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ status: statusFilter, priority: priorityFilter, page: String(page) });
    fetch(`${API}/admin/support/tickets?${params}`, { headers, credentials: "include" })
      .then((r) => r.json())
      .then((data) => { setTickets(data.tickets); setTotal(data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, statusFilter, priorityFilter, page]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Open" value={stats.open} icon={<AlertCircle className="h-5 w-5 text-blue-500" />} />
          <StatCard label="In Progress" value={stats.inProgress} icon={<Hourglass className="h-5 w-5 text-yellow-500" />} />
          <StatCard label="Waiting" value={stats.waiting} icon={<Clock className="h-5 w-5 text-orange-500" />} />
          <StatCard label="Resolved" value={stats.resolved} icon={<CheckCircle className="h-5 w-5 text-green-500" />} />
          <StatCard label="Avg Response" value={`${stats.avgResponseHours}h`} icon={<HeadphonesIcon className="h-5 w-5 text-purple-500" />} />
        </div>
      )}

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="AWAITING_CUSTOMER">Awaiting</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Priority</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No tickets found.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Ticket</th>
                <th className="text-left p-3 font-medium">Customer</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Priority</th>
                <th className="text-left p-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t hover:bg-accent/30">
                  <td className="p-3">
                    <Link href={`/admin/support/${t.ticketNumber}`}>
                      <span className="text-primary hover:underline font-mono text-xs">{t.ticketNumber}</span>
                    </Link>
                    <p className="text-sm mt-0.5 truncate max-w-[200px]">{t.subject}</p>
                  </td>
                  <td className="p-3 text-sm">{t.customerName}</td>
                  <td className="p-3"><Badge className={STATUS_COLORS[t.status] ?? ""} variant="secondary">{t.status.replace(/_/g, " ")}</Badge></td>
                  <td className="p-3"><Badge className={PRIORITY_COLORS[t.priority] ?? ""} variant="secondary">{t.priority}</Badge></td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(t.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm py-2">Page {page} of {Math.ceil(total / 20)}</span>
          <Button size="sm" variant="outline" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        {icon}
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

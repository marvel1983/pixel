import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
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

const STATUS_BADGE: Record<string, string> = {
  OPEN: "border-sky-500 bg-sky-500/20 text-sky-200",
  IN_PROGRESS: "border-amber-500 bg-amber-500/20 text-amber-200",
  AWAITING_CUSTOMER: "border-orange-500 bg-orange-500/20 text-orange-200",
  RESOLVED: "border-emerald-500 bg-emerald-500/20 text-emerald-200",
  CLOSED: "border-[#3d4558] bg-[#1a1f2e] text-[#8fa0bb]",
};

const PRIORITY_BADGE: Record<string, string> = {
  LOW: "border-[#3d4558] bg-[#1a1f2e] text-[#8fa0bb]",
  MEDIUM: "border-sky-600 bg-sky-500/15 text-sky-300",
  HIGH: "border-amber-600 bg-amber-500/15 text-amber-300",
  URGENT: "border-red-500 bg-red-500/20 text-red-200",
};

const thBase = "border-b border-r border-[#2a2e3a] bg-[#1e2128] px-2.5 py-[8px] text-[10.5px] font-bold uppercase tracking-widest select-none whitespace-nowrap card-title";
const tableCell = "border-b border-r border-[#1f2840] px-2.5 py-[7px] align-middle text-[12.5px] text-[#dde4f0]";

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
    <div className="space-y-3 text-[#e8edf5]">
      <h1 className="text-2xl font-bold tracking-tight text-white">Support Tickets</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Open" value={stats.open} accent="border-l-sky-500" icon={<AlertCircle className="h-5 w-5 text-sky-400" />} />
          <StatCard label="In Progress" value={stats.inProgress} accent="border-l-amber-500" icon={<Hourglass className="h-5 w-5 text-amber-400" />} />
          <StatCard label="Waiting" value={stats.waiting} accent="border-l-orange-500" icon={<Clock className="h-5 w-5 text-orange-400" />} />
          <StatCard label="Resolved" value={stats.resolved} accent="border-l-emerald-500" icon={<CheckCircle className="h-5 w-5 text-emerald-400" />} />
          <StatCard label="Avg Response" value={`${stats.avgResponseHours}h`} accent="border-l-purple-500" icon={<HeadphonesIcon className="h-5 w-5 text-purple-400" />} />
        </div>
      )}

      <div className="flex gap-2.5">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] h-8 border-[#3d4558] bg-[#0f1117] text-[#e8edf5] text-[13px]"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#181c24] border-[#2e3340] text-[#dde4f0]">
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="AWAITING_CUSTOMER">Awaiting</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] h-8 border-[#3d4558] bg-[#0f1117] text-[#e8edf5] text-[13px]"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#181c24] border-[#2e3340] text-[#dde4f0]">
            <SelectItem value="ALL">All Priority</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#8fa0bb]" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 text-[#8fa0bb]">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-[13px]">No tickets found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[#1e2a40] bg-[#0c1018]" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          <table className="w-full border-collapse text-left" style={{ borderSpacing: 0 }}>
            <thead>
              <tr className="border-b-2 border-[#2a2e3a]" style={{ backgroundColor: "#1e2128" }}>
                <th className={`${thBase} min-w-[200px]`}>Ticket</th>
                <th className={`${thBase} min-w-[140px]`}>Customer</th>
                <th className={`${thBase} w-[140px]`}>Status</th>
                <th className={`${thBase} w-[100px]`}>Priority</th>
                <th className={`${thBase} w-[140px] border-r-0`}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t, idx) => (
                <tr key={t.id} className={`transition-colors duration-75 ${idx % 2 === 0 ? "bg-[#0c1018] hover:bg-[#111825]" : "bg-[#0f1520] hover:bg-[#141e2e]"}`}>
                  <td className={tableCell}>
                    <Link href={`/admin/support/${t.ticketNumber}`}>
                      <span className="font-mono text-[11px] text-sky-400 hover:text-sky-200 hover:underline underline-offset-2">{t.ticketNumber}</span>
                    </Link>
                    <p className="text-[12.5px] mt-0.5 truncate max-w-[200px] text-[#dde4f0]">{t.subject}</p>
                  </td>
                  <td className={`${tableCell} text-[#8fa0bb]`}>{t.customerName}</td>
                  <td className={tableCell}>
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[t.status] ?? "border-[#3d4558] bg-[#1a1f2e] text-[#c8d0e0]"}`}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className={tableCell}>
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${PRIORITY_BADGE[t.priority] ?? "border-[#3d4558] bg-[#1a1f2e] text-[#c8d0e0]"}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className={`${tableCell} text-[11px] text-[#8fa0bb] border-r-0`}>{new Date(t.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" className="border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] disabled:opacity-40" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-[13px] text-[#8fa0bb] py-2">Page {page} of {Math.ceil(total / 20)}</span>
          <Button size="sm" variant="outline" className="border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] disabled:opacity-40" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent, icon }: { label: string; value: number | string; accent: string; icon: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border border-[#2e3340] bg-[#181c24] p-4 border-l-2 ${accent}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e2128]">{icon}</div>
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-[11px] text-[#8fa0bb] uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { FileText, Clock, CheckCircle, XCircle, Send, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface QuoteProduct { productId: number; productName: string; quantity: number }
interface Quote {
  id: number;
  companyName: string;
  contactName: string;
  contactEmail: string;
  phone: string | null;
  products: QuoteProduct[];
  message: string | null;
  status: "NEW" | "QUOTED" | "ACCEPTED" | "DECLINED";
  adminNotes: string | null;
  customPricing: unknown;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  NEW: { label: "New", color: "bg-blue-100 text-blue-700", icon: Clock },
  QUOTED: { label: "Quoted", color: "bg-amber-100 text-amber-700", icon: Send },
  ACCEPTED: { label: "Accepted", color: "bg-green-100 text-green-700", icon: CheckCircle },
  DECLINED: { label: "Declined", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function AdminQuotesPage() {
  const token = useAuthStore.getState().token;
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => { fetchQuotes(); }, []);

  const fetchQuotes = async () => {
    try {
      const res = await fetch(`${API}/admin/quotes`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setQuotes(data.quotes ?? []);
    } catch { toast({ title: "Failed to load quotes", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const updateStatus = async (id: number, status: string, adminNotes?: string, pricingMap?: Record<number, string>, products?: QuoteProduct[]) => {
    const customPricing = pricingMap && products ? products
      .filter((p) => pricingMap[p.productId] && Number(pricingMap[p.productId]) > 0)
      .map((p) => ({ productId: p.productId, productName: p.productName, quantity: p.quantity, unitPrice: Number(pricingMap[p.productId]) })) : undefined;
    try {
      const res = await fetch(`${API}/admin/quotes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, ...(adminNotes !== undefined && { adminNotes }), ...(customPricing && customPricing.length > 0 && { customPricing }) }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as Record<string, string>).error ?? "Update failed"); }
      toast({ title: `Quote #${id} updated to ${status}` });
      fetchQuotes();
    } catch { toast({ title: "Update failed", variant: "destructive" }); }
  };

  const filtered = filter === "ALL" ? quotes : quotes.filter((q) => q.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quote Requests</h1>
          <p className="text-sm text-muted-foreground">Manage business quote requests</p>
        </div>
        <div className="flex gap-2">
          {["ALL", "NEW", "QUOTED", "ACCEPTED", "DECLINED"].map((s) => (
            <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => setFilter(s)}>
              {s === "ALL" ? "All" : STATUS_CONFIG[s]?.label}
              {s !== "ALL" && <span className="ml-1 text-xs">({quotes.filter((q) => q.status === s).length})</span>}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading quotes...</div>
      ) : filtered.length === 0 ? (
        <div className="border rounded-lg bg-white p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No quote requests found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <QuoteCard key={q.id} quote={q} expanded={expandedId === q.id} onToggle={() => setExpandedId(expandedId === q.id ? null : q.id)} onUpdateStatus={updateStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

interface QuoteCardProps {
  quote: Quote;
  expanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (id: number, status: string, notes?: string, pricingMap?: Record<number, string>, products?: QuoteProduct[]) => void;
}

function QuoteCard({ quote, expanded, onToggle, onUpdateStatus }: QuoteCardProps) {
  const [notes, setNotes] = useState(quote.adminNotes ?? "");
  const [pricing, setPricing] = useState<Record<number, string>>(() => {
    const cp = quote.customPricing as Array<{ productId: number; unitPrice: string }> | null;
    if (!cp || !Array.isArray(cp)) return {};
    const m: Record<number, string> = {};
    for (const item of cp) m[item.productId] = String(item.unitPrice);
    return m;
  });
  const sc = STATUS_CONFIG[quote.status];
  const StatusIcon = sc.icon;

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold">#{quote.id}</span>
            <span className="font-medium">{quote.companyName}</span>
            <Badge className={`${sc.color} text-xs`}><StatusIcon className="h-3 w-3 mr-1" />{sc.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {quote.contactName} · {quote.contactEmail} · {quote.products.length} product(s) · {new Date(quote.createdAt).toLocaleDateString()}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="border-t p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><p className="text-xs text-muted-foreground">Contact</p><p className="text-sm">{quote.contactName} — {quote.contactEmail}{quote.phone ? ` — ${quote.phone}` : ""}</p></div>
            <div><p className="text-xs text-muted-foreground">Company</p><p className="text-sm font-medium">{quote.companyName}</p></div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Requested Products & Custom Pricing</p>
            <div className="space-y-1">
              {(quote.products as QuoteProduct[]).map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm border rounded px-3 py-1.5">
                  <span className="flex-1">{p.productName}</span>
                  <span className="font-medium">×{p.quantity}</span>
                  <span className="text-xs text-muted-foreground">$</span>
                  <input type="number" step="0.01" min="0" placeholder="Unit price" className="w-24 border rounded px-2 py-1 text-sm bg-background" value={pricing[p.productId] ?? ""} onChange={(e) => setPricing((prev) => ({ ...prev, [p.productId]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>
          {quote.message && <div><p className="text-xs text-muted-foreground mb-1">Message</p><p className="text-sm bg-muted/30 rounded p-2">{quote.message}</p></div>}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Admin Notes</p>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm bg-background min-h-[60px] resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes..." />
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <Button size="sm" variant="outline" onClick={() => onUpdateStatus(quote.id, "QUOTED", notes, pricing, quote.products)}>Send Quote</Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onUpdateStatus(quote.id, "ACCEPTED", notes)}>Accept</Button>
            <Button size="sm" variant="destructive" onClick={() => onUpdateStatus(quote.id, "DECLINED", notes)}>Decline</Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Send, CheckCircle, XCircle, Copy, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface OrderDetail {
  order: {
    id: number; orderNumber: string; guestEmail: string | null; userId: number | null;
    status: string; paymentMethod: string | null; subtotalUsd: string; discountUsd: string;
    totalUsd: string; walletAmountUsed: string | null; currencyCode: string; currencyRate: string;
    couponId: number | null; paymentIntentId: string | null; externalOrderId: string | null;
    ipAddress: string | null; notes: string | null; createdAt: string; updatedAt: string;
  };
  items: { id: number; productName: string; variantName: string; priceUsd: string; quantity: number }[];
  licenseKeys: { orderItemId: number; id: number; keyValue: string; status: string }[];
  customer: { id: number; email: string; firstName: string | null; lastName: string | null; createdAt: string } | null;
  coupon: { id: number; code: string; discountPercent: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800", PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800", FAILED: "bg-red-100 text-red-800",
  REFUNDED: "bg-purple-100 text-purple-800", PARTIALLY_REFUNDED: "bg-orange-100 text-orange-800",
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/admin/orders/${params.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setData(d); setNotes(d.order.notes ?? ""); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id, token]);

  const updateStatus = async (status: string) => {
    if (!confirm(`Change order status to ${status}?`)) return;
    await fetch(`${API}/admin/orders/${params.id}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    window.location.reload();
  };

  const saveNotes = async () => {
    setSaving(true);
    await fetch(`${API}/admin/orders/${params.id}/notes`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSaving(false);
  };

  const copyKey = (key: string) => navigator.clipboard.writeText(key);

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  if (!data) return <div className="p-12 text-center text-muted-foreground">Order not found</div>;

  const { order, items, licenseKeys, customer, coupon } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/admin/orders"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Orders</Button></Link>
        <h1 className="text-xl font-bold">{order.orderNumber}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-100"}`}>{order.status}</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => updateStatus("COMPLETED")} disabled={order.status === "COMPLETED"}>
          <CheckCircle className="mr-1 h-4 w-4" /> Mark Completed
        </Button>
        <Button size="sm" variant="outline" onClick={() => updateStatus("FAILED")} disabled={order.status === "FAILED"}>
          <XCircle className="mr-1 h-4 w-4" /> Mark Cancelled
        </Button>
        <Button size="sm" variant="outline" onClick={() => updateStatus("REFUNDED")} disabled={order.status === "REFUNDED"}>
          Issue Refund
        </Button>
        <Button size="sm" variant="outline"><Send className="mr-1 h-4 w-4" /> Resend Email</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Section title="Order Items">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Product</th><th className="pb-2">Variant</th><th className="pb-2 text-right">Price</th><th className="pb-2 text-center">Qty</th><th className="pb-2 text-right">Line Total</th>
              </tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2">{item.productName}</td>
                    <td className="py-2 text-muted-foreground">{item.variantName}</td>
                    <td className="py-2 text-right font-mono">${item.priceUsd}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right font-mono font-semibold">${(parseFloat(item.priceUsd) * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="License Keys">
            {licenseKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">No license keys assigned to this order.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const itemKeys = licenseKeys.filter((k) => k.orderItemId === item.id);
                  if (itemKeys.length === 0) return null;
                  return (
                    <div key={item.id}>
                      <p className="text-xs font-medium text-muted-foreground mb-1">{item.productName} — {item.variantName}</p>
                      {itemKeys.map((k) => (
                        <div key={k.id} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-1.5 mb-1">
                          <code className="flex-1 text-xs font-mono">{k.keyValue}</code>
                          <Badge variant="secondary" className="text-xs">{k.status}</Badge>
                          <button onClick={() => copyKey(k.keyValue)} className="p-1 hover:bg-gray-200 rounded" title="Copy">
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {order.externalOrderId && (
            <Section title="Metenzi Order">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <InfoRow label="External Order ID" value={order.externalOrderId} />
                <InfoRow label="Payment Intent" value={order.paymentIntentId ?? "—"} />
              </div>
            </Section>
          )}

          <Section title="Admin Notes">
            <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes about this order..." />
            <Button size="sm" onClick={saveNotes} disabled={saving} className="mt-2"><Save className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save Notes"}</Button>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Order Summary">
            <div className="space-y-1.5 text-sm">
              <InfoRow label="Subtotal" value={`$${order.subtotalUsd}`} />
              {parseFloat(order.discountUsd) > 0 && <InfoRow label="Discount" value={`-$${order.discountUsd}`} className="text-red-600" />}
              {coupon && <InfoRow label="Coupon" value={`${coupon.code} (${coupon.discountPercent}%)`} />}
              <div className="border-t pt-1.5"><InfoRow label="Total" value={`$${order.totalUsd}`} className="font-bold" /></div>
              <InfoRow label="Payment" value={order.paymentMethod ?? "—"} />
              <InfoRow label="Currency" value={`${order.currencyCode} (×${order.currencyRate})`} />
            </div>
          </Section>

          <Section title="Customer">
            {customer ? (
              <div className="space-y-1.5 text-sm">
                <InfoRow label="Name" value={`${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "—"} />
                <InfoRow label="Email" value={customer.email} />
                <InfoRow label="Account since" value={new Date(customer.createdAt).toLocaleDateString()} />
              </div>
            ) : (
              <div className="space-y-1.5 text-sm">
                <InfoRow label="Guest email" value={order.guestEmail ?? "—"} />
                <p className="text-xs text-muted-foreground">Guest checkout (no account)</p>
              </div>
            )}
          </Section>

          <Section title="Order Info">
            <div className="space-y-1.5 text-sm">
              <InfoRow label="Order ID" value={String(order.id)} />
              <InfoRow label="Created" value={new Date(order.createdAt).toLocaleString()} />
              <InfoRow label="Updated" value={new Date(order.updatedAt).toLocaleString()} />
              {order.ipAddress && <InfoRow label="IP Address" value={order.ipAddress} />}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="font-semibold text-sm mb-3">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={className}>{value}</span>
    </div>
  );
}

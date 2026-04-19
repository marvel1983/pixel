import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Send, CheckCircle, XCircle, Copy, Save, Clock, RotateCcw, Key, AlertTriangle, ShieldAlert, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { RefundModal } from "@/components/admin/refund-modal";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface OrderDetail {
  order: {
    id: number; orderNumber: string; guestEmail: string | null; userId: number | null;
    status: string; paymentMethod: string | null; subtotalUsd: string; discountUsd: string;
    totalUsd: string; walletAmountUsed: string | null; currencyCode: string; currencyRate: string;
    cppSelected: boolean; cppAmountUsd: string; couponId: number | null;
    paymentIntentId: string | null; externalOrderId: string | null;
    ipAddress: string | null; notes: string | null; createdAt: string; updatedAt: string;
    riskScore: number | null; riskReasons: string[] | null;
  };
  stripePaymentDetails: {
    status: string; cardBrand?: string; cardLast4?: string;
    cardExpMonth?: number; cardExpYear?: number; cardCountry?: string; cardFunding?: string;
    declineCode?: string; declineMessage?: string;
  } | null;
  items: { id: number; productName: string; variantName: string; priceUsd: string; quantity: number }[];
  licenseKeys: { orderItemId: number; id: number; keyValue: string; status: string }[];
  customer: { id: number; email: string; firstName: string | null; lastName: string | null; createdAt: string } | null;
  coupon: { id: number; code: string; discountPercent: string } | null;
  timeline: { event: string; date: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:            "border-amber-400   bg-amber-500/40   text-amber-100   font-bold",
  PROCESSING:         "border-sky-400     bg-sky-500/40     text-sky-100     font-bold",
  COMPLETED:          "border-emerald-400 bg-emerald-500/40 text-emerald-100 font-bold",
  FAILED:             "border-red-400     bg-red-500/40     text-red-100     font-bold",
  REFUNDED:           "border-violet-400  bg-violet-500/40  text-violet-100  font-bold",
  PARTIALLY_REFUNDED: "border-orange-400  bg-orange-500/40  text-orange-100  font-bold",
  HELD:               "border-rose-400    bg-rose-500/40    text-rose-100    font-bold",
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [redelivering, setRedelivering] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [syncingKeys, setSyncingKeys] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const syncOrderIdRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((s) => s.token);

  const reload = () => {
    setLoading(true);
    fetch(`${API}/admin/orders/${params.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setData(d); setNotes(d.order.notes ?? ""); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [params.id, token]);

  const updateStatus = async (status: string) => {
    if (!confirm(`Change order status to ${status}?`)) return;
    await fetch(`${API}/admin/orders/${params.id}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    reload();
  };

  const resendEmail = async () => {
    if (!confirm("Resend order confirmation email?")) return;
    await fetch(`${API}/admin/orders/${params.id}/resend-email`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    alert("Email queued for resend");
  };

  const redeliverKeys = async () => {
    if (!confirm("Re-fetch keys from Metenzi and assign them to this order?")) return;
    setRedelivering(true);
    try {
      const r = await fetch(`${API}/admin/orders/${params.id}/redeliver-keys`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error ?? "Failed"); } else { alert("Keys redelivered successfully"); reload(); }
    } catch { alert("Request failed"); }
    setRedelivering(false);
  };

  const retryFulfillment = async () => {
    if (!confirm("Retry Metenzi fulfillment for this order? Only use this after topping up your Metenzi balance or resolving the API issue.")) return;
    setRetrying(true);
    try {
      const r = await fetch(`${API}/admin/orders/${params.id}/retry-fulfillment`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error ?? "Failed"); } else { alert(d.message ?? "Fulfillment retry enqueued"); reload(); }
    } catch { alert("Request failed"); }
    setRetrying(false);
  };

  const syncBackorderKeys = async () => {
    const metenziOrderId = syncOrderIdRef.current?.value.trim() || undefined;
    setSyncingKeys(true);
    try {
      const r = await fetch(`${API}/admin/orders/${params.id}/sync-backorder-keys`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ metenziOrderId }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error ?? "Failed"); } else { alert(d.message); reload(); }
    } catch { alert("Request failed"); }
    setSyncingKeys(false);
  };

  const releaseHeld = async () => {
    if (!confirm("Release this order? This will run fulfillment and deliver keys to the customer.")) return;
    setReleasing(true);
    try {
      const r = await fetch(`${API}/admin/orders/${params.id}/release`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error ?? "Release failed"); } else { reload(); }
    } catch { alert("Request failed"); }
    setReleasing(false);
  };

  const cancelHeld = async () => {
    if (!confirm("Reject this order? Status will be set to FAILED. You must handle any refund manually.")) return;
    await fetch(`${API}/admin/orders/${params.id}/cancel-hold`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    reload();
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

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48 bg-[#1a2235]" />
      <Skeleton className="h-64 bg-[#1a2235]" />
      <Skeleton className="h-64 bg-[#1a2235]" />
    </div>
  );
  if (!data) return <div className="p-12 text-center text-[#5a6a84]">Order not found</div>;

  const { order, items, licenseKeys, customer, coupon, timeline, stripePaymentDetails } = data;

  return (
    <div className="space-y-4 text-[#dde4f0]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/admin/orders">
          <button className="flex items-center gap-1.5 rounded border border-[#1e3a5f] bg-[#0d2040] px-3 py-1.5 text-[12px] font-medium text-[#a8d4f5] hover:bg-[#112550] transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Orders
          </button>
        </Link>
        <h1 className="font-mono text-xl font-bold text-white tracking-tight">{order.orderNumber}</h1>
        <span className={`inline-flex items-center rounded border px-2.5 py-0.5 text-[11px] uppercase tracking-wider ${STATUS_COLORS[order.status] ?? "border-[#4b5568] bg-[#2a3040] text-[#cbd5e1]"}`}>
          {order.status.replace("_", " ")}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {order.status === "HELD" ? (
          <>
            <ActionBtn onClick={releaseHeld} disabled={releasing} icon={<CheckCircle className="h-3.5 w-3.5" />} color="emerald">
              {releasing ? "Releasing..." : "Release & Fulfill"}
            </ActionBtn>
            <ActionBtn onClick={cancelHeld} icon={<XCircle className="h-3.5 w-3.5" />} color="red">
              Reject Order
            </ActionBtn>
          </>
        ) : (
          <>
            <ActionBtn onClick={() => updateStatus("COMPLETED")} disabled={order.status === "COMPLETED"} icon={<CheckCircle className="h-3.5 w-3.5" />} color="emerald">
              Mark Completed
            </ActionBtn>
            <ActionBtn onClick={() => updateStatus("FAILED")} disabled={order.status === "FAILED"} icon={<XCircle className="h-3.5 w-3.5" />} color="red">
              Mark Failed
            </ActionBtn>
          </>
        )}
        <ActionBtn onClick={() => setRefundOpen(true)} disabled={order.status === "REFUNDED"} icon={<RotateCcw className="h-3.5 w-3.5" />} color="violet">
          Issue Refund
        </ActionBtn>
        <ActionBtn onClick={resendEmail} icon={<Send className="h-3.5 w-3.5" />} color="sky">
          Resend Email
        </ActionBtn>
        {order.externalOrderId && (
          <ActionBtn onClick={redeliverKeys} disabled={redelivering} icon={<Key className="h-3.5 w-3.5" />} color="amber">
            {redelivering ? "Re-delivering..." : "Re-deliver Keys"}
          </ActionBtn>
        )}
        {order.status === "PROCESSING" && !order.externalOrderId && (
          <ActionBtn onClick={retryFulfillment} disabled={retrying} icon={<RotateCcw className="h-3.5 w-3.5" />} color="orange">
            {retrying ? "Retrying..." : "Retry Fulfillment"}
          </ActionBtn>
        )}
      </div>

      {order.status === "HELD" && (
        <div className="flex items-start gap-3 rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-200">
          <BadgeCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
          <div className="space-y-0.5 min-w-0">
            <p className="font-semibold text-emerald-300">Payment captured — €{parseFloat(order.totalUsd).toFixed(2)}</p>
            {stripePaymentDetails?.cardLast4 && (
              <p className="text-[12px] text-emerald-300/80">
                {stripePaymentDetails.cardBrand ? <span className="capitalize">{stripePaymentDetails.cardBrand}</span> : "Card"}
                {" "}•••• {stripePaymentDetails.cardLast4}
                {stripePaymentDetails.cardExpMonth && stripePaymentDetails.cardExpYear && (
                  <span className="text-emerald-400/60 ml-1">{String(stripePaymentDetails.cardExpMonth).padStart(2,"0")}/{stripePaymentDetails.cardExpYear}</span>
                )}
                {stripePaymentDetails.cardCountry && <span className="text-emerald-400/60 ml-1">· {stripePaymentDetails.cardCountry}</span>}
              </p>
            )}
            {order.paymentIntentId && (
              <p className="text-[11px] text-emerald-400/60 font-mono truncate">ID: {order.paymentIntentId}</p>
            )}
          </div>
        </div>
      )}

      {order.status === "HELD" && order.riskScore != null && (
        <div className="flex items-start gap-3 rounded border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" />
          <div>
            <span className="font-semibold">Risk score: {order.riskScore}</span>
            {order.riskReasons && order.riskReasons.length > 0 && (
              <ul className="mt-1 list-disc list-inside text-[12px] text-rose-300 space-y-0.5">
                {order.riskReasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">

          {/* Order Items */}
          <Card title="Order Items">
            <div className="overflow-x-auto rounded border border-[#2e3340]">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-[#1e2128]">
                    <th className="border-b border-[#2a2e3a] px-3 py-[8px] text-left text-[10.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff"}}>Product</th>
                    <th className="border-b border-[#2a2e3a] px-3 py-[8px] text-left text-[10.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff"}}>Variant</th>
                    <th className="border-b border-[#2a2e3a] px-3 py-[8px] text-right text-[10.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff"}}>Price</th>
                    <th className="border-b border-[#2a2e3a] px-3 py-[8px] text-center text-[10.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff"}}>Qty</th>
                    <th className="border-b border-[#2a2e3a] px-3 py-[8px] text-right text-[10.5px] font-bold uppercase tracking-widest" style={{color:"#ffffff"}}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? "bg-[#0c1018]" : "bg-[#0f1520]"}>
                      <td className="border-b border-[#1f2840] px-3 py-2 text-[#dde4f0] font-medium">{item.productName}</td>
                      <td className="border-b border-[#1f2840] px-3 py-2 text-[#8fa0bb]">{item.variantName}</td>
                      <td className="border-b border-[#1f2840] px-3 py-2 text-right font-mono tabular-nums text-[#dde4f0]">€{item.priceUsd}</td>
                      <td className="border-b border-[#1f2840] px-3 py-2 text-center text-[#dde4f0]">{item.quantity}</td>
                      <td className="border-b border-[#1f2840] px-3 py-2 text-right font-mono tabular-nums font-bold text-white">€{(parseFloat(item.priceUsd) * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Payment Info */}
          <Card title="Payment Info">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              <InfoRow label="Method" value={(order.paymentMethod ?? "—").toUpperCase()} highlight />
              <InfoRow label="Payment ID" value={order.paymentIntentId ?? "—"} mono />
              <InfoRow label="Currency" value={`${order.currencyCode} (×${order.currencyRate})`} />
              {parseFloat(order.walletAmountUsed ?? "0") > 0 && <InfoRow label="Wallet Used" value={`€${order.walletAmountUsed}`} />}
            </div>
            {stripePaymentDetails && (
              <div className="mt-3 pt-3 border-t border-[#2e3340] space-y-3">
                {/* Card details */}
                {stripePaymentDetails.cardLast4 && (
                  <div className="flex items-center gap-3">
                    <div className="rounded bg-[#1e2128] px-3 py-2 flex items-center gap-2.5">
                      <span className="text-[13px] font-semibold text-[#dde4f0] capitalize">{stripePaymentDetails.cardBrand ?? "Card"}</span>
                      <span className="font-mono text-[13px] text-[#8fa0bb]">•••• {stripePaymentDetails.cardLast4}</span>
                      {stripePaymentDetails.cardExpMonth && stripePaymentDetails.cardExpYear && (
                        <span className="text-[11px] text-[#5a6a84]">{String(stripePaymentDetails.cardExpMonth).padStart(2, "0")}/{stripePaymentDetails.cardExpYear}</span>
                      )}
                      {stripePaymentDetails.cardFunding && (
                        <span className="text-[10px] uppercase tracking-widest text-[#5a6a84] bg-[#2a2e3a] px-1.5 py-0.5 rounded">{stripePaymentDetails.cardFunding}</span>
                      )}
                      {stripePaymentDetails.cardCountry && (
                        <span className="text-[11px] text-[#5a6a84]">{stripePaymentDetails.cardCountry}</span>
                      )}
                    </div>
                  </div>
                )}
                {/* Decline info */}
                {(stripePaymentDetails.declineCode || stripePaymentDetails.declineMessage) && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px]">
                    <p className="font-semibold text-red-400 mb-0.5">Payment declined</p>
                    {stripePaymentDetails.declineCode && <p className="text-red-300">Code: <span className="font-mono">{stripePaymentDetails.declineCode}</span></p>}
                    {stripePaymentDetails.declineMessage && <p className="text-red-300">{stripePaymentDetails.declineMessage}</p>}
                  </div>
                )}
                {/* Pending state */}
                {!stripePaymentDetails.cardLast4 && !stripePaymentDetails.declineCode && order.status === "PENDING" && (
                  <p className="text-[12px] text-[#5a6a84]">Awaiting payment — customer has not completed checkout yet.</p>
                )}
              </div>
            )}
          </Card>

          {order.externalOrderId && (
            <Card title="Metenzi Order">
              <InfoRow label="External Order ID" value={order.externalOrderId} mono />
            </Card>
          )}

          {/* License Keys */}
          <Card title="License Keys">
            {(() => {
              const totalExpected = items.reduce((s, i) => s + i.quantity, 0);
              const totalDelivered = licenseKeys.length;
              const missing = totalExpected - totalDelivered;
              return (
                <>
                  {missing > 0 && (
                    <div className="mb-3 rounded border border-amber-500/40 bg-amber-900/20 px-3 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                        <p className="text-[12.5px] font-semibold text-amber-300">
                          {missing} key{missing > 1 ? "s" : ""} missing — {totalDelivered} of {totalExpected} delivered
                        </p>
                      </div>
                      <p className="text-[11.5px] text-amber-400/80 mb-2">
                        If the key has been assigned on Metenzi, enter that order ID below and click Sync.
                      </p>
                      <div className="flex gap-2">
                        <input
                          ref={syncOrderIdRef}
                          defaultValue={order.externalOrderId ?? ""}
                          placeholder="Metenzi order ID (e.g. 7aba34d0-...)"
                          className="flex-1 rounded border border-[#1e3a5f] bg-[#0a1828] px-2.5 py-1.5 text-[12px] font-mono text-[#dde4f0] placeholder:text-[#3d5070] focus:border-amber-500/60 focus:outline-none"
                        />
                        <button
                          onClick={syncBackorderKeys}
                          disabled={syncingKeys}
                          className="rounded border border-amber-400 bg-amber-600/30 px-3 py-1.5 text-[12px] font-semibold text-amber-200 hover:bg-amber-600/50 disabled:opacity-40 transition-colors whitespace-nowrap"
                        >
                          {syncingKeys ? "Syncing..." : "Sync Keys"}
                        </button>
                      </div>
                    </div>
                  )}
                  {licenseKeys.length === 0 ? (
                    <p className="text-[12.5px] text-[#4a5a74]">No license keys assigned.</p>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item) => {
                        const itemKeys = licenseKeys.filter((k) => k.orderItemId === item.id);
                        if (itemKeys.length === 0) return null;
                        return (
                          <div key={item.id}>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5b9fd4] mb-1.5">{item.productName} — {item.variantName}</p>
                            {itemKeys.map((k) => (
                              <div key={k.id} className="flex items-center gap-2 rounded border border-[#2e3340] bg-[#212530] px-3 py-2 mb-1.5">
                                <code className="flex-1 text-[12px] font-mono text-[#dde4f0] tracking-wide">{k.keyValue}</code>
                                <span className="rounded border border-emerald-400/50 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200 uppercase">{k.status}</span>
                                <button onClick={() => navigator.clipboard.writeText(k.keyValue)} className="rounded p-1 text-[#5b9fd4] hover:bg-[#1e3a5f] hover:text-white transition-colors">
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </Card>

          {/* Admin Notes */}
          <Card title="Admin Notes">
            <textarea
              className="w-full rounded border border-[#1e3a5f] bg-[#0a1828] px-3 py-2 text-[12.5px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30 resize-none"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes..."
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 flex items-center gap-1.5 rounded border border-sky-500/50 bg-sky-600/20 px-3 py-1.5 text-[12px] font-medium text-sky-200 hover:bg-sky-600/30 disabled:opacity-50 transition-colors"
            >
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Notes"}
            </button>
          </Card>

          {/* Timeline */}
          <Card title="Timeline">
            <div className="space-y-3">
              {timeline.map((t, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-sky-500/40 bg-sky-500/10 flex items-center justify-center">
                    <Clock className="h-3 w-3 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-[12.5px] font-medium text-[#dde4f0]">{t.event}</p>
                    <p className="text-[11px] text-[#5a6a84]">{new Date(t.date).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Order Summary */}
          <Card title="Order Summary">
            <div className="space-y-2 text-[12.5px]">
              <SummaryRow label="Subtotal" value={`€${order.subtotalUsd}`} />
              {parseFloat(order.discountUsd) > 0 && <SummaryRow label="Discount" value={`-€${order.discountUsd}`} valueClass="text-rose-300 font-semibold" />}
              {coupon && <SummaryRow label="Coupon" value={`${coupon.code} (${coupon.discountPercent}%)`} valueClass="text-amber-300" />}
              {order.cppSelected && <SummaryRow label="CPP" value={`€${order.cppAmountUsd}`} valueClass="text-purple-300" />}
              <div className="mt-2 border-t border-[#2e3340] pt-2">
                <SummaryRow label="Total" value={`€${order.totalUsd}`} labelClass="font-bold text-white" valueClass="font-bold text-white text-[14px]" />
              </div>
            </div>
          </Card>

          {/* Customer */}
          <Card title="Customer">
            {customer ? (
              <div className="space-y-2 text-[12.5px]">
                <SummaryRow label="Name" value={`${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "—"} />
                <SummaryRow label="Email" value={customer.email} valueClass="text-sky-300" />
                <SummaryRow label="Since" value={new Date(customer.createdAt).toLocaleDateString()} />
              </div>
            ) : (
              <div className="space-y-2 text-[12.5px]">
                <SummaryRow label="Email" value={order.guestEmail ?? "—"} valueClass="text-sky-300" />
                <p className="text-[11px] text-[#4a5a74]">Guest checkout</p>
              </div>
            )}
          </Card>

          {/* CPP Status */}
          <Card title="CPP Status">
            <div className="space-y-2 text-[12.5px]">
              <SummaryRow
                label="Selected"
                value={order.cppSelected ? "Yes" : "No"}
                valueClass={order.cppSelected ? "text-purple-300 font-semibold" : "text-[#4a5a74]"}
              />
              {order.cppSelected && <SummaryRow label="Amount" value={`€${order.cppAmountUsd}`} />}
              <p className="text-[11px] text-[#4a5a74]">{order.cppSelected ? "Customer Protection Program active" : "Not enrolled"}</p>
            </div>
          </Card>

          {/* Order Info */}
          <Card title="Order Info">
            <div className="space-y-2 text-[12.5px]">
              <SummaryRow label="Order ID" value={String(order.id)} valueClass="font-mono" />
              <SummaryRow label="Created" value={new Date(order.createdAt).toLocaleString()} />
              <SummaryRow label="Updated" value={new Date(order.updatedAt).toLocaleString()} />
              {order.ipAddress && <SummaryRow label="IP" value={order.ipAddress} valueClass="font-mono text-[11px]" />}
            </div>
          </Card>
        </div>
      </div>

      {data && (
        <RefundModal
          orderId={data.order.id}
          orderNumber={data.order.orderNumber}
          orderTotal={data.order.totalUsd}
          open={refundOpen}
          onClose={() => setRefundOpen(false)}
          onSuccess={reload}
        />
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
      <div className="border-b border-[#2a2e3a] px-4 py-3 bg-[#1e2128]">
        <p className="card-title text-[13px] font-bold uppercase tracking-widest">{title}</p>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10.5px] uppercase tracking-wider text-[#4a5a74]">{label}</span>
      <span className={`text-[12.5px] ${mono ? "font-mono text-[11.5px]" : ""} ${highlight ? "font-bold text-[#a8d4f5]" : "text-[#dde4f0]"}`}>{value}</span>
    </div>
  );
}

function SummaryRow({ label, value, labelClass, valueClass }: { label: string; value: string; labelClass?: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-[#8fa0bb] ${labelClass ?? ""}`}>{label}</span>
      <span className={`tabular-nums ${valueClass ?? "text-[#dde4f0]"}`}>{value}</span>
    </div>
  );
}

function ActionBtn({ onClick, disabled, icon, color, children }: {
  onClick: () => void; disabled?: boolean; icon: React.ReactNode; color: string; children: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    emerald: "border-emerald-300 bg-emerald-500  hover:bg-emerald-400",
    red:     "border-red-300     bg-[#e53e3e]    hover:bg-[#fc5c5c]",
    violet:  "border-violet-300  bg-[#7c3aed]   hover:bg-[#8b5cf6]",
    sky:     "border-sky-300     bg-[#0284c7]   hover:bg-[#0ea5e9]",
    amber:   "border-amber-300   bg-amber-600   hover:bg-amber-500",
    orange:  "border-orange-300  bg-orange-600  hover:bg-orange-500",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colors[color]}`}
      style={{color: "#ffffff"}}
    >
      {icon}{children}
    </button>
  );
}

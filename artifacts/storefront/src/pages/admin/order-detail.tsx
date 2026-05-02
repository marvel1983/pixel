import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Send, CheckCircle, XCircle, RotateCcw, Key, AlertTriangle, ShieldAlert, BadgeCheck, Save, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { RefundModal } from "@/components/admin/refund-modal";
import { Card, InfoRow, ActionBtn, STATUS_COLORS, formatMoney, type OrderDetail } from "@/components/admin/order-detail-ui";
import { OrderKeysCard } from "@/components/admin/order-keys-card";
import { OrderDetailSidebar } from "@/components/admin/order-detail-sidebar";
import { OrderTimeline } from "@/components/admin/order-timeline";
import { RefundsCard } from "@/components/admin/refunds-card";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [redelivering, setRedelivering] = useState(false);
  const [forcing, setForcing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [syncingKeys, setSyncingKeys] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const syncOrderIdRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((s) => s.token);

  const reload = () => {
    setLoading(true);
    fetch(`${API}/admin/orders/${params.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => { setData(d); setNotes(d.order.notes ?? ""); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, [params.id, token]);

  const updateStatus = async (status: string) => {
    if (!confirm(`Change order status to ${status}?`)) return;
    await fetch(`${API}/admin/orders/${params.id}/status`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    reload();
  };
  const resendEmail = async () => {
    if (!confirm("Resend order confirmation email?")) return;
    await fetch(`${API}/admin/orders/${params.id}/resend-email`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    alert("Email queued for resend");
  };
  const redeliverKeys = async () => {
    if (!confirm("Re-fetch keys from Metenzi and assign them to this order?")) return;
    setRedelivering(true);
    try {
      const r = await fetch(`${API}/admin/orders/${params.id}/redeliver-keys`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) alert(d.error ?? "Failed"); else { alert("Keys redelivered successfully"); reload(); }
    } catch { alert("Request failed"); }
    setRedelivering(false);
  };
  const forceFulfill = async () => {
    if (!confirm("Force fulfillment? This re-fetches keys from Metenzi and signals payment confirmation in case their fulfillment gate hasn't run.")) return;
    setForcing(true);
    try {
      const r = await fetch(`${API}/admin/orders/${params.id}/force-fulfill`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) { alert(d.error ?? "Force fulfill failed"); return; }
      const summary = `Outcome: ${d.outcome}\nKeys delivered now: ${d.keysProcessed}\n${d.totalDelivered}/${d.totalExpected} total delivered.${d.metenziStatus ? `\nMetenzi status: ${d.metenziStatus}` : ""}${d.confirmPaymentResult ? `\nConfirm-payment: ${d.confirmPaymentResult}` : ""}${d.hint ? `\n\n${d.hint}` : ""}`;
      alert(summary);
      reload();
    } catch { alert("Request failed"); }
    setForcing(false);
  };
  const retryFulfillment = async () => {
    if (!confirm("Retry Metenzi fulfillment for this order? Only use this after topping up your Metenzi balance or resolving the API issue.")) return;
    setRetrying(true);
    try {
      const r = await fetch(`${API}/admin/orders/${params.id}/retry-fulfillment`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) alert(d.error ?? "Failed"); else { alert(d.message ?? "Fulfillment retry enqueued"); reload(); }
    } catch { alert("Request failed"); }
    setRetrying(false);
  };
  const syncBackorderKeys = async (metenziOrderId: string | undefined) => {
    setSyncingKeys(true);
    try {
      const r = await fetch(`${API}/admin/orders/${params.id}/sync-backorder-keys`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ metenziOrderId }) });
      const d = await r.json();
      if (!r.ok) alert(d.error ?? "Failed"); else { alert(d.message); reload(); }
    } catch { alert("Request failed"); }
    setSyncingKeys(false);
  };
  const manualAssignKeys = async (entries: Array<{ orderItemId: number; key: string }>) => {
    const r = await fetch(`${API}/admin/orders/${params.id}/manual-assign-keys`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ keys: entries }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? "Manual assign failed");
    alert(`${d.keysAdded} key(s) assigned. Order is now ${d.newStatus}.`);
    reload();
  };
  const releaseHeld = async () => {
    if (!confirm("Release this order? This will run fulfillment and deliver keys to the customer.")) return;
    setReleasing(true);
    try {
      const r = await fetch(`${API}/admin/orders/${params.id}/release`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) alert(d.error ?? "Release failed"); else reload();
    } catch { alert("Request failed"); }
    setReleasing(false);
  };
  const cancelHeld = async () => {
    if (!confirm("Reject this order? Status will be set to FAILED. You must handle any refund manually.")) return;
    await fetch(`${API}/admin/orders/${params.id}/cancel-hold`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    reload();
  };
  const saveNotes = async () => {
    setSaving(true);
    await fetch(`${API}/admin/orders/${params.id}/notes`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ notes }) });
    setSaving(false);
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48 bg-[#1a2235]" /><Skeleton className="h-64 bg-[#1a2235]" /><Skeleton className="h-64 bg-[#1a2235]" /></div>;
  if (!data) return <div className="p-12 text-center text-[#5a6a84]">Order not found</div>;
  const { order, items, licenseKeys, customer, coupon, timeline, stripePaymentDetails, refunds: orderRefunds } = data;
  const completedRefundTotal = (orderRefunds ?? []).filter((r) => r.status === "COMPLETED").reduce((s, r) => s + parseFloat(r.amountUsd), 0);
  const isRefunded = order.status === "REFUNDED" || order.status === "PARTIALLY_REFUNDED";
  const fmtMoney = (amt: string | number) => formatMoney(amt, order.currencyRate, order.currencyCode);

  return (
    <div className="space-y-4 text-[#dde4f0]">
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

      <div className="flex gap-2 flex-wrap">
        {order.status === "HELD" ? (
          <>
            <ActionBtn onClick={releaseHeld} disabled={releasing} icon={<CheckCircle className="h-3.5 w-3.5" />} color="emerald">{releasing ? "Releasing..." : "Release & Fulfill"}</ActionBtn>
            <ActionBtn onClick={cancelHeld} icon={<XCircle className="h-3.5 w-3.5" />} color="red">Reject Order</ActionBtn>
          </>
        ) : (
          <>
            <ActionBtn onClick={() => updateStatus("COMPLETED")} disabled={order.status === "COMPLETED"} icon={<CheckCircle className="h-3.5 w-3.5" />} color="emerald">Mark Completed</ActionBtn>
            <ActionBtn onClick={() => updateStatus("FAILED")} disabled={order.status === "FAILED"} icon={<XCircle className="h-3.5 w-3.5" />} color="red">Mark Failed</ActionBtn>
          </>
        )}
        <ActionBtn onClick={() => setRefundOpen(true)} disabled={order.status === "REFUNDED"} icon={<RotateCcw className="h-3.5 w-3.5" />} color="violet">Issue Refund</ActionBtn>
        <ActionBtn onClick={resendEmail} icon={<Send className="h-3.5 w-3.5" />} color="sky">Resend Email</ActionBtn>
        {order.externalOrderId && <ActionBtn onClick={redeliverKeys} disabled={redelivering} icon={<Key className="h-3.5 w-3.5" />} color="amber">{redelivering ? "Re-delivering..." : "Re-deliver Keys"}</ActionBtn>}
        {order.externalOrderId && order.status !== "COMPLETED" && <ActionBtn onClick={forceFulfill} disabled={forcing} icon={<Zap className="h-3.5 w-3.5" />} color="violet">{forcing ? "Forcing..." : "Force Fulfill"}</ActionBtn>}
        {order.status === "PROCESSING" && !order.externalOrderId && <ActionBtn onClick={retryFulfillment} disabled={retrying} icon={<RotateCcw className="h-3.5 w-3.5" />} color="orange">{retrying ? "Retrying..." : "Retry Fulfillment"}</ActionBtn>}
      </div>

      {isRefunded && (
        <div className="flex items-start gap-3 rounded border border-violet-500/50 bg-violet-500/10 px-4 py-3 text-[13px] text-violet-100">
          <RotateCcw className="h-4 w-4 mt-0.5 shrink-0 text-violet-300" />
          <div className="space-y-0.5 min-w-0">
            <p className="font-bold text-violet-200">
              {order.status === "REFUNDED" ? "Order fully refunded" : "Order partially refunded"} — {fmtMoney(completedRefundTotal)} returned of {fmtMoney(order.totalUsd)}
            </p>
            <p className="text-[12px] text-violet-200/80">See the Refunds section below for breakdown of each refund and Stripe IDs.</p>
          </div>
        </div>
      )}

      {order.status === "HELD" && (
        <div className="flex items-start gap-3 rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-200">
          <BadgeCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
          <div className="space-y-0.5 min-w-0">
            <p className="font-semibold text-emerald-300">Payment captured — €{parseFloat(order.totalUsd).toFixed(2)}</p>
            {stripePaymentDetails?.cardLast4 && (
              <p className="text-[12px] text-emerald-300/80">
                {stripePaymentDetails.cardBrand ? <span className="capitalize">{stripePaymentDetails.cardBrand}</span> : "Card"} •••• {stripePaymentDetails.cardLast4}
                {stripePaymentDetails.cardExpMonth && stripePaymentDetails.cardExpYear && <span className="text-emerald-400/60 ml-1">{String(stripePaymentDetails.cardExpMonth).padStart(2, "0")}/{stripePaymentDetails.cardExpYear}</span>}
                {stripePaymentDetails.cardCountry && <span className="text-emerald-400/60 ml-1">· {stripePaymentDetails.cardCountry}</span>}
              </p>
            )}
            {order.paymentIntentId && <p className="text-[11px] text-emerald-400/60 font-mono truncate">ID: {order.paymentIntentId}</p>}
          </div>
        </div>
      )}
      {order.status === "HELD" && order.riskScore != null && (
        <div className="flex items-start gap-3 rounded border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" />
          <div>
            <span className="font-semibold">Risk score: {order.riskScore}</span>
            {order.riskReasons && order.riskReasons.length > 0 && (
              <ul className="mt-1 list-disc list-inside text-[12px] text-rose-300 space-y-0.5">{order.riskReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Order Items">
            <div className="overflow-x-auto rounded border border-[#2e3340]">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-[#1e2128]">
                    {["Product", "Variant", "Price", "Qty", "Line Total"].map((h) => (
                      <th key={h} className="border-b border-[#2a2e3a] px-3 py-[8px] text-left text-[10.5px] font-bold uppercase tracking-widest" style={{ color: "#ffffff" }}>{h}</th>
                    ))}
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
          <Card title="Payment Info">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              <InfoRow label="Method" value={(order.paymentMethod ?? "—").toUpperCase()} highlight />
              <InfoRow label="Payment ID" value={order.paymentIntentId ?? "—"} mono />
              <InfoRow label="Currency" value={`${order.currencyCode} (×${order.currencyRate})`} />
              {parseFloat(order.walletAmountUsed ?? "0") > 0 && <InfoRow label="Wallet Used" value={`€${order.walletAmountUsed}`} />}
            </div>
            {stripePaymentDetails?.cardLast4 && (
              <div className="mt-3 pt-3 border-t border-[#2e3340]">
                <div className="rounded bg-[#1e2128] px-3 py-2 flex items-center gap-2.5">
                  <span className="text-[13px] font-semibold text-[#dde4f0] capitalize">{stripePaymentDetails.cardBrand ?? "Card"}</span>
                  <span className="font-mono text-[13px] text-[#8fa0bb]">•••• {stripePaymentDetails.cardLast4}</span>
                  {stripePaymentDetails.cardExpMonth && stripePaymentDetails.cardExpYear && <span className="text-[11px] text-[#5a6a84]">{String(stripePaymentDetails.cardExpMonth).padStart(2, "0")}/{stripePaymentDetails.cardExpYear}</span>}
                  {stripePaymentDetails.cardFunding && <span className="text-[10px] uppercase tracking-widest text-[#5a6a84] bg-[#2a2e3a] px-1.5 py-0.5 rounded">{stripePaymentDetails.cardFunding}</span>}
                  {stripePaymentDetails.cardCountry && <span className="text-[11px] text-[#5a6a84]">{stripePaymentDetails.cardCountry}</span>}
                </div>
                {(stripePaymentDetails.declineCode || stripePaymentDetails.declineMessage) && (
                  <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px]">
                    <p className="font-semibold text-red-400 mb-0.5">Payment declined</p>
                    {stripePaymentDetails.declineCode && <p className="text-red-300">Code: <span className="font-mono">{stripePaymentDetails.declineCode}</span></p>}
                    {stripePaymentDetails.declineMessage && <p className="text-red-300">{stripePaymentDetails.declineMessage}</p>}
                  </div>
                )}
              </div>
            )}
          </Card>
          {order.externalOrderId && <Card title="Metenzi Order"><InfoRow label="External Order ID" value={order.externalOrderId} mono /></Card>}
          {(orderRefunds ?? []).length > 0 && <RefundsCard refunds={orderRefunds} orderTotalUsd={order.totalUsd} currencyCode={order.currencyCode} currencyRate={order.currencyRate} />}
          <OrderKeysCard items={items} licenseKeys={licenseKeys} externalOrderId={order.externalOrderId} syncingKeys={syncingKeys} onSync={syncBackorderKeys} syncOrderIdRef={syncOrderIdRef} onManualAssign={manualAssignKeys} />
          <Card title="Admin Notes">
            <textarea className="w-full rounded border border-[#1e3a5f] bg-[#0a1828] px-3 py-2 text-[12.5px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30 resize-none" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes..." />
            <button onClick={saveNotes} disabled={saving} className="mt-2 flex items-center gap-1.5 rounded border border-sky-500/50 bg-sky-600/20 px-3 py-1.5 text-[12px] font-medium text-sky-200 hover:bg-sky-600/30 disabled:opacity-50 transition-colors">
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Notes"}
            </button>
          </Card>
          <Card title="Timeline">
            <OrderTimeline entries={timeline} />
          </Card>
        </div>
        <OrderDetailSidebar order={order} coupon={coupon} customer={customer} refunds={orderRefunds ?? []} />
      </div>

      {data && <RefundModal orderId={data.order.id} orderNumber={data.order.orderNumber} orderTotal={data.order.totalUsd} currencyCode={data.order.currencyCode} currencyRate={data.order.currencyRate} paymentIntentId={data.order.paymentIntentId} open={refundOpen} onClose={() => setRefundOpen(false)} onSuccess={reload} />}
    </div>
  );
}

import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Send, CheckCircle, XCircle, RotateCcw, Key, AlertTriangle, ShieldAlert, BadgeCheck, Save, Zap, Stethoscope, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { RefundModal } from "@/components/admin/refund-modal";
import { Card, InfoRow, ActionBtn, STATUS_COLORS, formatMoney, type OrderDetail } from "@/components/admin/order-detail-ui";
import { OrderKeysCard } from "@/components/admin/order-keys-card";
import { OrderDetailSidebar } from "@/components/admin/order-detail-sidebar";
import { OrderTimeline } from "@/components/admin/order-timeline";
import { RefundsCard } from "@/components/admin/refunds-card";
import { PaymentAttemptsCard } from "@/components/admin/payment-attempts-card";
import { CustomerJourneyCard } from "@/components/admin/customer-journey-card";

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
  const [diagnosing, setDiagnosing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const syncOrderIdRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((s) => s.token);

  const diagnose = async () => {
    setDiagnosing(true);
    try {
      const r = await fetch(`${API}/admin/orders/${params.id}/diagnose`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error ?? "Diagnostics failed"); return; }
      setDiagnostics(d);
    } catch { alert("Diagnostics request failed"); }
    setDiagnosing(false);
  };

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
  const { order, items, licenseKeys, customer, coupon, timeline, stripePaymentDetails, paymentAttempts, refunds: orderRefunds } = data;
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
        <ActionBtn onClick={diagnose} disabled={diagnosing} icon={<Stethoscope className="h-3.5 w-3.5" />} color="sky">{diagnosing ? "Diagnosing..." : "Diagnose"}</ActionBtn>
      </div>

      {diagnostics && <DiagnosticsPanel data={diagnostics} onClose={() => setDiagnostics(null)} />}

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
          </Card>
          {(order.paymentMethod === "CARD" || order.paymentMethod === "MIXED") && (
            <PaymentAttemptsCard attempts={paymentAttempts ?? []} />
          )}
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
          <CustomerJourneyCard orderId={order.id} token={token} />
        </div>
        <OrderDetailSidebar order={order} coupon={coupon} customer={customer} refunds={orderRefunds ?? []} />
      </div>

      {data && <RefundModal orderId={data.order.id} orderNumber={data.order.orderNumber} orderTotal={data.order.totalUsd} currencyCode={data.order.currencyCode} currencyRate={data.order.currencyRate} paymentIntentId={data.order.paymentIntentId} open={refundOpen} onClose={() => setRefundOpen(false)} onSuccess={reload} />}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DiagnosticsPanel({ data, onClose }: { data: any; onClose: () => void }) {
  const verdictColor: Record<string, string> = {
    fulfilled: "border-emerald-500 bg-emerald-500/10 text-emerald-200",
    metenzi_out_of_stock: "border-red-500 bg-red-500/10 text-red-200",
    metenzi_no_keys_yet: "border-amber-500 bg-amber-500/10 text-amber-200",
    metenzi_api_error: "border-red-500 bg-red-500/10 text-red-200",
    local_delivery_pipeline: "border-violet-500 bg-violet-500/10 text-violet-200",
    no_external_order: "border-slate-500 bg-slate-500/10 text-slate-200",
  };
  const v = data.verdict;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-full max-w-3xl flex flex-col h-full bg-[#0a0f1a] border-l border-[#1e2a40] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-[#1e2a40] bg-[#0c1320]">
          <h2 className="text-sm font-bold text-[#dde4f0] flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-sky-400" />
            Order Diagnostics
          </h2>
          <button onClick={onClose} className="text-[#5a6a84] hover:text-[#dde4f0]"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4 text-[12px]">
          {/* Verdict */}
          <div className={`rounded border px-3 py-2.5 ${verdictColor[v.code] ?? "border-[#3d4558] bg-[#1a1f2e] text-[#dde4f0]"}`}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5 opacity-80">Verdict — {v.code}</div>
            <div className="text-[13px] font-medium">{v.msg}</div>
          </div>

          <DSection title="Order">
            <DRow label="Status" value={data.order.status} />
            <DRow label="External Order ID" value={data.order.externalOrderId ?? "(none)"} mono />
            <DRow label="Created" value={new Date(data.order.createdAt).toLocaleString()} />
            <DRow label="Total" value={`${data.order.totalUsd} ${data.order.currencyCode ?? ""}`} />
          </DSection>

          <DSection title={`Order items (${data.items.length})`}>
            {data.items.map((it: any) => (
              <div key={it.id} className="rounded border border-[#1e2a40] bg-[#0c1320] p-2.5 mb-2 last:mb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[#dde4f0] font-medium">{it.productName} <span className="text-[#5a6a84]">/{it.pixelProductSlug}</span></div>
                    <div className="text-[11px] text-[#8fa0bb]">Variant: {it.variantName} · Pixel product id {it.productId} · Variant id {it.variantId}</div>
                  </div>
                  <span className={`text-[11px] font-bold ${it.delivered >= it.quantity ? "text-emerald-300" : "text-amber-300"}`}>
                    {it.delivered}/{it.quantity} delivered
                  </span>
                </div>
                <div className="text-[11px] text-[#8fa0bb] mt-1">
                  Pixel stock cache: <strong className="text-[#dde4f0]">{it.stockCount}</strong>
                  {it.backorderAllowed && <span className="ml-2 text-amber-300">backorder allowed</span>}
                </div>
                {it.deliveredKeys.length > 0 && (
                  <div className="mt-1 text-[11px] text-[#8fa0bb]">
                    Keys: {it.deliveredKeys.map((k: any) => k.mask).join(", ")}
                  </div>
                )}
              </div>
            ))}
          </DSection>

          <DSection title="Metenzi mappings for order's Pixel products">
            {data.mappings.length === 0 ? (
              <div className="text-rose-300 text-[12px]">⚠ No mappings — order's Pixel product is not linked to any Metenzi product. Fulfillment will never run automatically.</div>
            ) : data.mappings.map((m: any) => (
              <div key={m.id} className="rounded border border-[#1e2a40] bg-[#0c1320] p-2.5 mb-2 last:mb-0">
                <DRow label="Metenzi product id" value={m.metenziProductId} mono />
                <DRow label="Metenzi name (cached)" value={m.metenziName ?? "—"} />
                <DRow label="Metenzi SKU (cached)" value={m.metenziSku ?? "—"} mono />
                <DRow label="Pixel product id" value={String(m.pixelProductId)} />
                <DRow label="Auto-sync stock" value={m.autoSyncStock ? "yes" : "no"} />
                <DRow label="Disabled" value={m.disabled ? "YES (admin unmapped)" : "no"} />
                <DRow label="Last stock sync" value={m.lastStockSyncAt ? new Date(m.lastStockSyncAt).toLocaleString() : "never"} />
              </div>
            ))}
          </DSection>

          {data.siblingMappings && data.siblingMappings.length > data.mappings.length && (
            <DSection title="Other Pixel products sharing the same Metenzi key pool (1:N)">
              {data.siblingMappings.map((m: any) => (
                <div key={m.id} className="text-[11px] text-[#dde4f0] py-1 border-b border-[#1a2436] last:border-0">
                  Metenzi <span className="font-mono">{m.metenziProductId.slice(0, 8)}…</span> → Pixel #{m.pixelProductId} <span className="text-[#8fa0bb]">{m.pixelProductName ?? ""}</span>
                  {m.disabled && <span className="ml-1 text-rose-400">(disabled)</span>}
                </div>
              ))}
            </DSection>
          )}

          <DSection title="Live Metenzi order state">
            {data.metenziOrder.error
              ? <div className="text-rose-300">⚠ {data.metenziOrder.error}</div>
              : (
                <>
                  <DRow label="Metenzi status" value={data.metenziOrder.status ?? "(none)"} />
                  <DRow label="Keys at Metenzi" value={String(data.metenziOrder.keyCount)} />
                  {data.metenziOrder.keys.length > 0 && (
                    <div className="mt-1 text-[11px] text-[#8fa0bb]">
                      Keys: {data.metenziOrder.keys.map((k: any, i: number) => (
                        <span key={i} className="font-mono mr-2">{k.codeMasked} <span className="text-[#5a6a84]">(prod {k.productId?.slice(0, 8)}…)</span></span>
                      ))}
                    </div>
                  )}
                </>
              )}
          </DSection>

          <DSection title="Live Metenzi stock for mapped products">
            {data.metenziProductStocks.length === 0 ? (
              <div className="text-[#8fa0bb]">(no mappings to check)</div>
            ) : data.metenziProductStocks.map((p: any) => (
              <div key={p.metenziProductId} className="rounded border border-[#1e2a40] bg-[#0c1320] p-2.5 mb-2 last:mb-0">
                <div className="text-[11px] text-[#8fa0bb] font-mono mb-0.5">{p.metenziProductId}</div>
                {p.error ? (
                  <div className="text-rose-300">⚠ {p.error}</div>
                ) : (
                  <>
                    <DRow label="Live stock" value={<span className={p.stock === 0 ? "text-rose-300 font-bold" : "text-[#dde4f0]"}>{p.stock ?? "n/a"}{p.stock === 0 ? " ⚠ OUT OF STOCK AT METENZI" : ""}</span>} />
                    <DRow label="Status" value={p.status ?? "n/a"} />
                  </>
                )}
              </div>
            ))}
          </DSection>

          <DSection title={`Recent audit log (${data.recentAudit.length})`}>
            {data.recentAudit.length === 0
              ? <div className="text-[#5a6a84]">(no entries)</div>
              : data.recentAudit.slice(0, 10).map((a: any) => (
                <div key={a.id} className="text-[11px] py-1 border-b border-[#1a2436] last:border-0">
                  <div className="text-[#8fa0bb]">
                    <span className="text-[#dde4f0] font-medium">{a.action}</span> · {a.entityType ?? "?"} · {new Date(a.createdAt).toLocaleString()}
                  </div>
                  <pre className="font-mono text-[10px] text-[#6b7c98] mt-0.5 whitespace-pre-wrap break-all">{JSON.stringify(a.details, null, 0)}</pre>
                </div>
              ))}
          </DSection>

          <DSection title={`Job queue history (${data.recentJobs.length})`}>
            {data.recentJobs.length === 0
              ? <div className="text-[#5a6a84]">(no entries)</div>
              : data.recentJobs.map((j: any) => (
                <div key={j.id} className="text-[11px] py-1 border-b border-[#1a2436] last:border-0">
                  <div className="flex items-center justify-between">
                    <div><span className="text-[#dde4f0] font-medium">{j.name}</span> <span className="text-[#8fa0bb]">[{j.status}]</span></div>
                    <span className="text-[10px] text-[#5a6a84]">{new Date(j.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] text-[#6b7c98]">attempts {j.attempts}/{j.maxAttempts} · scheduled {new Date(j.scheduledAt).toLocaleString()}</div>
                  {j.lastError && <div className="text-rose-300 text-[10px] mt-0.5">{j.lastError}</div>}
                </div>
              ))}
          </DSection>

          {data.recentJobFailures.length > 0 && (
            <DSection title={`Job failures (${data.recentJobFailures.length})`}>
              {data.recentJobFailures.map((f: any) => (
                <div key={f.id} className="text-[11px] py-1 border-b border-[#1a2436] last:border-0">
                  <div className="text-[#dde4f0]">{f.name} <span className="text-[#5a6a84]">attempt {f.attempt}</span> · {new Date(f.failedAt).toLocaleString()}</div>
                  <div className="text-rose-300 text-[10px]">{f.error}</div>
                </div>
              ))}
            </DSection>
          )}
        </div>
      </div>
    </div>
  );
}

function DSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-[#1e2a40] bg-[#0c1320] p-3">
      <h3 className="text-[10.5px] font-bold uppercase tracking-widest text-[#8fa0bb] mb-2">{title}</h3>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function DRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11.5px]">
      <span className="text-[#8fa0bb] shrink-0">{label}</span>
      <span className={`text-right break-all ${mono ? "font-mono" : ""} text-[#dde4f0]`}>{value}</span>
    </div>
  );
}

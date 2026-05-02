import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { currencySymbol, formatMoney } from "@/components/admin/order-detail-ui";

const API = import.meta.env.VITE_API_URL ?? "/api";

const REASONS = ["Customer request", "Defective product", "Duplicate order", "Wrong product", "Other"];

interface Props {
  orderId: number;
  orderNumber: string;
  orderTotal: string;
  currencyCode: string;
  currencyRate: string;
  paymentIntentId: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Destination = "" | "wallet" | "stripe";

interface ExistingRefund {
  id: number; amountUsd: string; status: string; reason: string; createdAt: string;
}

export function RefundModal({ orderId, orderNumber, orderTotal, currencyCode, currencyRate, paymentIntentId, open, onClose, onSuccess }: Props) {
  const sym = currencySymbol(currencyCode);
  const fmt = (amt: string | number) => formatMoney(amt, currencyRate, currencyCode);
  const stripeDisabled = !paymentIntentId;
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [destination, setDestination] = useState<Destination>("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<ExistingRefund[]>([]);
  const [refundedTotal, setRefundedTotal] = useState(0);
  const token = useAuthStore((s) => s.token);

  const maxRefundable = Math.max(0, parseFloat(orderTotal) - refundedTotal);

  useEffect(() => {
    if (!open) return;
    fetch(`${API}/admin/refunds/order/${orderId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        setExisting(d.refunds);
        setRefundedTotal(d.refundedTotal);
        setAmount(Math.max(0, parseFloat(orderTotal) - d.refundedTotal).toFixed(2));
      })
      .catch(() => {});
  }, [open, orderId, orderTotal, token]);

  const handleSubmit = async () => {
    const refundAmt = parseFloat(amount);
    if (!refundAmt || refundAmt <= 0) { setError("Enter a valid refund amount"); return; }
    if (refundAmt > maxRefundable + 0.01) { setError(`Max refundable: ${fmt(maxRefundable)}`); return; }
    if (!destination) { setError("Choose a refund destination"); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/admin/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId, amount: refundAmt.toFixed(2), reason, notes: notes.trim() || undefined, notifyCustomer, refundToWallet: destination === "wallet" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Refund failed"); return; }
      onSuccess();
      onClose();
    } catch { setError("Network error"); } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Initiate Refund — {orderNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Order Total</span><span className="font-mono font-semibold">{fmt(orderTotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Already Refunded</span><span className="font-mono text-red-600">{fmt(refundedTotal)}</span></div>
            <div className="flex justify-between border-t pt-1"><span className="font-medium">Refundable</span><span className="font-mono font-bold">{fmt(maxRefundable)}</span></div>
          </div>

          {existing.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Previous Refunds</Label>
              {existing.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1">
                  <span className="font-mono">{fmt(r.amountUsd)}</span>
                  <Badge variant="secondary" className="text-[10px]">{r.status}</Badge>
                  <span className="text-muted-foreground ml-auto">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Refund Amount ({sym})</Label>
            <Input type="number" step="0.01" min="0.01" max={maxRefundable} value={amount}
              onChange={(e) => setAmount(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setAmount(maxRefundable.toFixed(2))}>Full Refund</Button>
              <Button variant="outline" size="sm" type="button" onClick={() => setAmount((maxRefundable / 2).toFixed(2))}>50%</Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={2} value={notes}
              onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes about this refund..." />
          </div>

          <div className="space-y-2">
            <Label>Refund destination <span className="text-red-500">*</span></Label>
            <div className="grid gap-2">
              <DestinationOption
                value="wallet"
                selected={destination === "wallet"}
                onSelect={() => setDestination("wallet")}
                title="Refund to customer wallet"
                detail="Adds the amount to the customer's PixelCodes wallet balance. Instant; no card refund."
              />
              <DestinationOption
                value="stripe"
                selected={destination === "stripe"}
                onSelect={() => !stripeDisabled && setDestination("stripe")}
                disabled={stripeDisabled}
                title="Refund by Stripe"
                detail={
                  stripeDisabled
                    ? "Unavailable — this order has no Stripe payment intent on file."
                    : "Returns the amount to the original card via Stripe. Customer sees it in 5–10 business days."
                }
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={notifyCustomer} onCheckedChange={(v) => setNotifyCustomer(!!v)} />
            <span className="text-sm">Notify customer via email</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || maxRefundable <= 0 || !destination} variant="destructive">
            {submitting ? "Processing..." : `Refund ${fmt(amount || "0")}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DestinationOption({ value, selected, onSelect, disabled, title, detail }: {
  value: "wallet" | "stripe"; selected: boolean; onSelect: () => void; disabled?: boolean; title: string; detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors w-full ${
        disabled
          ? "border-border/40 bg-muted/20 opacity-50 cursor-not-allowed"
          : selected
            ? "border-primary bg-primary/10"
            : "border-border bg-muted/30 hover:bg-muted/50 cursor-pointer"
      }`}
    >
      <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
        selected ? "border-primary" : "border-muted-foreground/40"
      }`}>
        {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground mt-0.5">{detail}</span>
      </span>
      <span className="sr-only">{value}</span>
    </button>
  );
}

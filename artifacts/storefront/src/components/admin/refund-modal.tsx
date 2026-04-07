import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

const REASONS = ["Customer request", "Defective product", "Duplicate order", "Wrong product", "Other"];

interface Props {
  orderId: number;
  orderNumber: string;
  orderTotal: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ExistingRefund {
  id: number; amountUsd: string; status: string; reason: string; createdAt: string;
}

export function RefundModal({ orderId, orderNumber, orderTotal, open, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [refundToWallet, setRefundToWallet] = useState(false);
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
    if (refundAmt > maxRefundable + 0.01) { setError(`Max refundable: $${maxRefundable.toFixed(2)}`); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/admin/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId, amount: refundAmt.toFixed(2), reason, notes: notes.trim() || undefined, notifyCustomer, refundToWallet }),
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
            <div className="flex justify-between"><span className="text-muted-foreground">Order Total</span><span className="font-mono font-semibold">${orderTotal}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Already Refunded</span><span className="font-mono text-red-600">${refundedTotal.toFixed(2)}</span></div>
            <div className="flex justify-between border-t pt-1"><span className="font-medium">Refundable</span><span className="font-mono font-bold">${maxRefundable.toFixed(2)}</span></div>
          </div>

          {existing.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Previous Refunds</Label>
              {existing.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1">
                  <span className="font-mono">${r.amountUsd}</span>
                  <Badge variant="secondary" className="text-[10px]">{r.status}</Badge>
                  <span className="text-muted-foreground ml-auto">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Refund Amount ($)</Label>
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

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={refundToWallet} onCheckedChange={(v) => setRefundToWallet(!!v)} />
            <span className="text-sm">Refund to customer wallet</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={notifyCustomer} onCheckedChange={(v) => setNotifyCustomer(!!v)} />
            <span className="text-sm">Notify customer via email</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || maxRefundable <= 0} variant="destructive">
            {submitting ? "Processing..." : `Refund $${amount || "0.00"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

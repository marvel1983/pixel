import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

interface Item { id: number; productName: string; variantName: string; quantity: number }
interface LicenseKey { orderItemId: number; id: number; keyValue: string; status: string }

interface Props {
  items: Item[];
  licenseKeys: LicenseKey[];
  onSubmit: (entries: Array<{ orderItemId: number; key: string }>) => Promise<void>;
  onClose: () => void;
}

interface Slot {
  rowKey: string;       // synthetic stable key for React (`${orderItemId}-${idx}`)
  orderItemId: number;
  productLabel: string;
  slotIndex: number;    // 1-based for UI display
  value: string;
}

function buildSlots(items: Item[], licenseKeys: LicenseKey[]): Slot[] {
  const deliveredByItem: Record<number, number> = {};
  for (const k of licenseKeys) {
    deliveredByItem[k.orderItemId] = (deliveredByItem[k.orderItemId] ?? 0) + 1;
  }
  const slots: Slot[] = [];
  for (const it of items) {
    const delivered = deliveredByItem[it.id] ?? 0;
    const missing = Math.max(0, it.quantity - delivered);
    for (let i = 0; i < missing; i++) {
      slots.push({
        rowKey: `${it.id}-${i}`,
        orderItemId: it.id,
        productLabel: `${it.productName} — ${it.variantName}`,
        slotIndex: delivered + i + 1,
        value: "",
      });
    }
  }
  return slots;
}

export function OrderManualKeyForm({ items, licenseKeys, onSubmit, onClose }: Props) {
  const initialSlots = useMemo(() => buildSlots(items, licenseKeys), [items, licenseKeys]);
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledCount = slots.filter((s) => s.value.trim().length > 0).length;
  const totalSlots = slots.length;

  if (totalSlots === 0) {
    return (
      <div className="rounded border border-emerald-500/40 bg-emerald-900/20 px-3 py-3 text-[12px] text-emerald-300">
        All keys are already delivered for this order. Nothing to add manually.
      </div>
    );
  }

  const updateSlot = (rowKey: string, value: string) => {
    setSlots((prev) => prev.map((s) => (s.rowKey === rowKey ? { ...s, value } : s)));
  };

  const submit = async () => {
    const entries = slots
      .map((s) => ({ orderItemId: s.orderItemId, key: s.value.trim() }))
      .filter((e) => e.key.length > 0);
    if (entries.length === 0) { setError("Enter at least one key"); return; }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded border border-sky-500/40 bg-sky-950/20 px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[12.5px] font-semibold text-sky-200">Add license keys manually</p>
        <button onClick={onClose} className="rounded p-1 text-[#5b9fd4] hover:bg-[#1e3a5f]" title="Close">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-[11.5px] text-sky-300/70 mb-3">
        Use this when Metenzi has not delivered keys but you have them from another source. Keys are encrypted, marked <code className="text-sky-200">SOLD</code> with source <code className="text-sky-200">MANUAL</code>, and an audit log entry is recorded.
      </p>
      <div className="space-y-2 mb-3">
        {slots.map((s) => (
          <div key={s.rowKey} className="flex items-center gap-2">
            <div className="w-[55%] text-[11.5px] text-[#8fa0bb] truncate" title={s.productLabel}>
              <span className="text-[#5b9fd4] mr-1.5">#{s.slotIndex}</span>{s.productLabel}
            </div>
            <input
              value={s.value}
              onChange={(e) => updateSlot(s.rowKey, e.target.value)}
              placeholder="paste license key"
              className="flex-1 rounded border border-[#1e3a5f] bg-[#0a1828] px-2.5 py-1.5 text-[12px] font-mono text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none"
            />
          </div>
        ))}
      </div>
      {error && <p className="mb-2 text-[11.5px] text-rose-300">{error}</p>}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[#5a6a84]">{filledCount} of {totalSlots} slots filled</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded border border-[#2e3340] bg-[#1a2235] px-3 py-1.5 text-[12px] font-medium text-[#8fa0bb] hover:bg-[#222a3e]">Cancel</button>
          <button
            onClick={submit}
            disabled={submitting || filledCount === 0}
            className="flex items-center gap-1.5 rounded border border-sky-500/60 bg-sky-600/30 px-3 py-1.5 text-[12px] font-semibold text-sky-200 hover:bg-sky-600/50 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> {submitting ? "Saving..." : `Assign ${filledCount} key${filledCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
